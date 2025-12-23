import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ResponseFormatter } from '../core/ResponseFormatter';
import type { FormatterConfigInput } from '../types/config';
import type { ResponseMeta } from '../types/responses';
import { generateRequestId } from '../utils/validators';
import type { FormattedRequest } from './responseWrapper';

/**
 * Error catcher options
 */
export interface ErrorCatcherOptions extends FormatterConfigInput {
  /** Log errors to console */
  logErrors?: boolean;
  
  /** Custom error logger */
  errorLogger?: (error: Error, req: Request) => void;
  
  /** Transform error before formatting */
  transformError?: (error: Error) => Error;
  
  /** Custom response handler */
  customHandler?: (error: Error, req: Request, res: Response) => boolean;
}

/**
 * Create error catching middleware
 */
export function errorCatcher(options: ErrorCatcherOptions = {}): ErrorRequestHandler {
  const {
    logErrors = true,
    errorLogger,
    transformError,
    customHandler,
    ...formatterConfig
  } = options;

  const formatter = new ResponseFormatter(formatterConfig);
  const config = formatter.getConfig();

  return (error: Error, req: Request, res: Response, _next: NextFunction): void => {
    // Allow custom handler to take over
    if (customHandler && customHandler(error, req, res)) {
      return;
    }

    // Log error
    if (logErrors) {
      if (errorLogger) {
        errorLogger(error, req);
      } else {
        console.error({
          message: error.message,
          name: error.name,
          stack: error.stack,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Transform error if transformer provided
    const finalError = transformError ? transformError(error) : error;

    // Build meta from request
    const formattedReq = req as FormattedRequest;
    const meta: ResponseMeta = {};

    if (formattedReq.requestId) {
      meta.requestId = formattedReq.requestId;
    } else {
      const requestId = req.get(config.requestIdHeader);
      if (requestId) {
        meta.requestId = requestId;
      }
    }

    if (formattedReq.correlationId) {
      meta.correlationId = formattedReq.correlationId;
    } else {
      const correlationId = req.get(config.correlationIdHeader);
      if (correlationId) {
        meta.correlationId = correlationId;
      }
    }

    // Format and send response
    const response = formatter.formatError(finalError, meta);
    const statusCode = formatter.getErrorStatusCode(finalError);

    res.status(statusCode).json(response);
  };
}

/**
 * Create error catcher with existing formatter
 */
export function createErrorCatcher(
  formatter: ResponseFormatter,
  options: Omit<ErrorCatcherOptions, keyof FormatterConfigInput> = {}
): ErrorRequestHandler {
  const { logErrors = true, errorLogger, transformError, customHandler } = options;
  const config = formatter.getConfig();

  return (error: Error, req: Request, res: Response, _next: NextFunction): void => {
    if (customHandler && customHandler(error, req, res)) {
      return;
    }

    if (logErrors) {
      if (errorLogger) {
        errorLogger(error, req);
      } else {
        console.error({
          message: error.message,
          name: error.name,
          stack: error.stack,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const finalError = transformError ? transformError(error) : error;

    const formattedReq = req as FormattedRequest;
    const meta: ResponseMeta = {};

    if (formattedReq.requestId) {
      meta.requestId = formattedReq.requestId;
    } else {
      const requestId = req.get(config.requestIdHeader);
      if (requestId) {
        meta.requestId = requestId;
      }
    }

    if (formattedReq.correlationId) {
      meta.correlationId = formattedReq.correlationId;
    } else {
      const correlationId = req.get(config.correlationIdHeader);
      if (correlationId) {
        meta.correlationId = correlationId;
      }
    }

    const response = formatter.formatError(finalError, meta);
    const statusCode = formatter.getErrorStatusCode(finalError);

    res.status(statusCode).json(response);
  };
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a try-catch wrapper for route handlers
 */
export function catchErrors<T>(
  fn: (req: Request, res: Response) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}
