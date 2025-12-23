import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import type { ResponseMeta } from '../types/responses';
import type { FormatterConfig } from '../types/config';
import { ResponseFormatter } from './ResponseFormatter';

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Log errors to console */
  logErrors: boolean;
  /** Custom error logger */
  errorLogger?: (error: Error, req: Request) => void;
  /** Transform error before formatting */
  transformError?: (error: Error) => Error;
  /** Handle non-operational errors differently */
  handleNonOperational?: (error: Error, req: Request, res: Response) => void;
}

const defaultErrorHandlerOptions: ErrorHandlerOptions = {
  logErrors: true,
};

/**
 * Error handler class for Express applications
 */
export class ErrorHandler {
  private formatter: ResponseFormatter;
  private options: ErrorHandlerOptions;
  private config: FormatterConfig;

  constructor(
    formatter: ResponseFormatter,
    options: Partial<ErrorHandlerOptions> = {}
  ) {
    this.formatter = formatter;
    this.options = { ...defaultErrorHandlerOptions, ...options };
    this.config = formatter.getConfig();
  }

  /**
   * Extract request metadata for error context
   */
  private extractMeta(req: Request): ResponseMeta {
    const meta: ResponseMeta = {};

    const requestId = req.get(this.config.requestIdHeader);
    if (requestId) {
      meta.requestId = requestId;
    }

    const correlationId = req.get(this.config.correlationIdHeader);
    if (correlationId) {
      meta.correlationId = correlationId;
    }

    return meta;
  }

  /**
   * Log error if enabled
   */
  private logError(error: Error, req: Request): void {
    if (!this.options.logErrors) return;

    if (this.options.errorLogger) {
      this.options.errorLogger(error, req);
      return;
    }

    const isOperational = error instanceof ApiError ? error.isOperational : false;
    const logLevel = isOperational ? 'warn' : 'error';

    console[logLevel]({
      message: error.message,
      name: error.name,
      stack: error.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if error is operational (expected)
   */
  private isOperationalError(error: Error): boolean {
    if (error instanceof ApiError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Handle the error and send response
   */
  handle(
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    // Log the error
    this.logError(error, req);

    // Transform error if transformer provided
    const transformedError = this.options.transformError
      ? this.options.transformError(error)
      : error;

    // Handle non-operational errors specially if handler provided
    if (!this.isOperationalError(transformedError) && this.options.handleNonOperational) {
      this.options.handleNonOperational(transformedError, req, res);
      return;
    }

    // Get status code and format response
    const statusCode = this.formatter.getErrorStatusCode(transformedError);
    const meta = this.extractMeta(req);
    const response = this.formatter.formatError(transformedError, meta);

    // Send response
    res.status(statusCode).json(response);
  }

  /**
   * Create Express error handling middleware
   */
  middleware(): (error: Error, req: Request, res: Response, next: NextFunction) => void {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      this.handle(error, req, res, next);
    };
  }
}

/**
 * Create an error handler instance
 */
export function createErrorHandler(
  formatter: ResponseFormatter,
  options?: Partial<ErrorHandlerOptions>
): ErrorHandler {
  return new ErrorHandler(formatter, options);
}

/**
 * Create error handling middleware directly
 */
export function errorHandlerMiddleware(
  formatter: ResponseFormatter,
  options?: Partial<ErrorHandlerOptions>
): (error: Error, req: Request, res: Response, next: NextFunction) => void {
  const handler = new ErrorHandler(formatter, options);
  return handler.middleware();
}
