import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ResponseFormatter } from '../core/ResponseFormatter';
import type { FormatterConfig, FormatterConfigInput } from '../types/config';
import type { ResponseMeta, PaginatedResponse, CursorPaginatedResponse } from '../types/responses';
import type { PaginationInput, CursorPaginationInput } from '../utils/validators';
import { generateRequestId } from '../utils/validators';

/**
 * Extended Express Response with formatter methods
 */
export interface FormattedResponse extends Response {
  /** Send a formatted success response */
  respond: <T>(data: T, meta?: ResponseMeta, statusCode?: number) => void;
  
  /** Send a formatted paginated response */
  respondPaginated: <T>(
    data: T[],
    pagination: Partial<PaginationInput>,
    meta?: ResponseMeta
  ) => void;
  
  /** Send a formatted cursor-paginated response */
  respondCursorPaginated: <T>(
    data: T[],
    pagination: CursorPaginationInput,
    meta?: ResponseMeta
  ) => void;
  
  /** Send a formatted error response */
  respondError: (error: Error, meta?: ResponseMeta) => void;
  
  /** Get the response formatter instance */
  formatter: ResponseFormatter;
}

/**
 * Extended Express Request with formatter context
 */
export interface FormattedRequest extends Request {
  /** Request ID for tracing */
  requestId: string;
  
  /** Correlation ID for distributed tracing */
  correlationId?: string;
}

/**
 * Middleware options
 */
export interface ResponseWrapperOptions extends FormatterConfigInput {
  /** Skip wrapping for specific paths */
  skipPaths?: string[];
  
  /** Skip wrapping based on custom condition */
  skipCondition?: (req: Request) => boolean;
}

/**
 * Create response wrapper middleware
 */
export function responseWrapper(
  options: ResponseWrapperOptions = {}
): RequestHandler {
  const { skipPaths = [], skipCondition, ...formatterConfig } = options;
  const formatter = new ResponseFormatter(formatterConfig);
  const config = formatter.getConfig();

  return (req: Request, res: Response, next: NextFunction): void => {
    const formattedReq = req as FormattedRequest;
    const formattedRes = res as FormattedResponse;

    // Check if should skip
    if (skipPaths.includes(req.path) || (skipCondition && skipCondition(req))) {
      next();
      return;
    }

    // Extract or generate request ID
    let requestId = req.get(config.requestIdHeader);
    if (!requestId && config.generateRequestId) {
      requestId = generateRequestId();
    }
    if (requestId) {
      formattedReq.requestId = requestId;
      res.setHeader(config.requestIdHeader, requestId);
    }

    // Extract correlation ID
    const correlationId = req.get(config.correlationIdHeader);
    if (correlationId) {
      formattedReq.correlationId = correlationId;
      res.setHeader(config.correlationIdHeader, correlationId);
    }

    // Attach formatter to response
    formattedRes.formatter = formatter;

    // Build base meta from request
    const buildMeta = (additionalMeta?: ResponseMeta): ResponseMeta => {
      const meta: ResponseMeta = {};
      if (requestId) meta.requestId = requestId;
      if (correlationId) meta.correlationId = correlationId;
      return { ...meta, ...additionalMeta };
    };

    // Get base URL for pagination links
    const getBaseUrl = (): string => {
      const protocol = req.protocol;
      const host = req.get('host') || 'localhost';
      return `${protocol}://${host}${req.originalUrl.split('?')[0]}`;
    };

    // Add respond method
    formattedRes.respond = <T>(data: T, meta?: ResponseMeta, statusCode?: number): void => {
      const response = formatter.formatSuccess(data, buildMeta(meta));
      const status = statusCode ?? formatter.getSuccessStatusCode(req.method, data !== undefined);
      res.status(status).json(response);
    };

    // Add respondPaginated method
    formattedRes.respondPaginated = <T>(
      data: T[],
      pagination: Partial<PaginationInput>,
      meta?: ResponseMeta
    ): void => {
      const response = formatter.formatPaginated(
        data,
        pagination,
        buildMeta(meta),
        getBaseUrl()
      );
      res.status(200).json(response);
    };

    // Add respondCursorPaginated method
    formattedRes.respondCursorPaginated = <T>(
      data: T[],
      pagination: CursorPaginationInput,
      meta?: ResponseMeta
    ): void => {
      const response = formatter.formatCursorPaginated(
        data,
        pagination,
        buildMeta(meta),
        getBaseUrl()
      );
      res.status(200).json(response);
    };

    // Add respondError method
    formattedRes.respondError = (error: Error, meta?: ResponseMeta): void => {
      const response = formatter.formatError(error, buildMeta(meta));
      const statusCode = formatter.getErrorStatusCode(error);
      res.status(statusCode).json(response);
    };

    next();
  };
}

/**
 * Create response wrapper with custom formatter
 */
export function createResponseWrapper(
  formatter: ResponseFormatter,
  options: Omit<ResponseWrapperOptions, keyof FormatterConfigInput> = {}
): RequestHandler {
  const { skipPaths = [], skipCondition } = options;
  const config = formatter.getConfig();

  return (req: Request, res: Response, next: NextFunction): void => {
    const formattedReq = req as FormattedRequest;
    const formattedRes = res as FormattedResponse;

    if (skipPaths.includes(req.path) || (skipCondition && skipCondition(req))) {
      next();
      return;
    }

    let requestId = req.get(config.requestIdHeader);
    if (!requestId && config.generateRequestId) {
      requestId = generateRequestId();
    }
    if (requestId) {
      formattedReq.requestId = requestId;
      res.setHeader(config.requestIdHeader, requestId);
    }

    const correlationId = req.get(config.correlationIdHeader);
    if (correlationId) {
      formattedReq.correlationId = correlationId;
      res.setHeader(config.correlationIdHeader, correlationId);
    }

    formattedRes.formatter = formatter;

    const buildMeta = (additionalMeta?: ResponseMeta): ResponseMeta => {
      const meta: ResponseMeta = {};
      if (requestId) meta.requestId = requestId;
      if (correlationId) meta.correlationId = correlationId;
      return { ...meta, ...additionalMeta };
    };

    const getBaseUrl = (): string => {
      const protocol = req.protocol;
      const host = req.get('host') || 'localhost';
      return `${protocol}://${host}${req.originalUrl.split('?')[0]}`;
    };

    formattedRes.respond = <T>(data: T, meta?: ResponseMeta, statusCode?: number): void => {
      const response = formatter.formatSuccess(data, buildMeta(meta));
      const status = statusCode ?? formatter.getSuccessStatusCode(req.method, data !== undefined);
      res.status(status).json(response);
    };

    formattedRes.respondPaginated = <T>(
      data: T[],
      pagination: Partial<PaginationInput>,
      meta?: ResponseMeta
    ): void => {
      const response = formatter.formatPaginated(data, pagination, buildMeta(meta), getBaseUrl());
      res.status(200).json(response);
    };

    formattedRes.respondCursorPaginated = <T>(
      data: T[],
      pagination: CursorPaginationInput,
      meta?: ResponseMeta
    ): void => {
      const response = formatter.formatCursorPaginated(data, pagination, buildMeta(meta), getBaseUrl());
      res.status(200).json(response);
    };

    formattedRes.respondError = (error: Error, meta?: ResponseMeta): void => {
      const response = formatter.formatError(error, buildMeta(meta));
      const statusCode = formatter.getErrorStatusCode(error);
      res.status(statusCode).json(response);
    };

    next();
  };
}
