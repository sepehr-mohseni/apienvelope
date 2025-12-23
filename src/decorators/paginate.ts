import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../core/ResponseFormatter';
import { PaginationHelper } from '../core/PaginationHelper';
import type { ResponseMeta } from '../types/responses';
import type { FormattedRequest } from '../middleware/responseWrapper';

/**
 * Pagination decorator options
 */
export interface PaginateDecoratorOptions {
  /** Default page size */
  defaultLimit?: number;
  
  /** Maximum page size */
  maxLimit?: number;
  
  /** Include HATEOAS links */
  includeLinks?: boolean;
  
  /** Additional metadata */
  meta?: ResponseMeta;
}

/**
 * Result type for paginated handlers
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/**
 * Cursor paginated result type
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
}

/**
 * Paginate decorator factory
 * Automatically handles pagination for route handlers
 */
export function Paginate(
  formatter: ResponseFormatter,
  options: PaginateDecoratorOptions = {}
): MethodDecorator {
  const paginationHelper = new PaginationHelper({
    defaultLimit: options.defaultLimit ?? 10,
    maxLimit: options.maxLimit ?? 100,
    includeLinks: options.includeLinks ?? false,
  });

  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        // Extract pagination params from request
        const { page, limit } = paginationHelper.extractFromRequest(req);

        // Inject pagination params into request for handler use
        (req as Request & { pagination: { page: number; limit: number; offset: number } }).pagination = {
          page,
          limit,
          offset: paginationHelper.calculateOffset(page, limit),
        };

        // Call original method - expects { data: T[], total: number }
        const result: PaginatedResult<unknown> = await originalMethod.call(this, req, res, next);

        if (res.headersSent) {
          return;
        }

        // Build meta
        const formattedReq = req as FormattedRequest;
        const meta: ResponseMeta = { ...options.meta };

        if (formattedReq.requestId) {
          meta.requestId = formattedReq.requestId;
        }
        if (formattedReq.correlationId) {
          meta.correlationId = formattedReq.correlationId;
        }

        // Get base URL for links
        const baseUrl = options.includeLinks
          ? `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`
          : undefined;

        // Format paginated response
        const response = formatter.formatPaginated(
          result.data,
          { page, limit, total: result.total },
          Object.keys(meta).length > 0 ? meta : undefined,
          baseUrl
        );

        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    };

    return descriptor;
  };
}

/**
 * Cursor paginate decorator factory
 */
export function CursorPaginate(
  formatter: ResponseFormatter,
  options: PaginateDecoratorOptions = {}
): MethodDecorator {
  const paginationHelper = new PaginationHelper({
    defaultLimit: options.defaultLimit ?? 10,
    maxLimit: options.maxLimit ?? 100,
    includeLinks: options.includeLinks ?? false,
  });

  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        // Extract cursor pagination params
        const { cursor, limit } = paginationHelper.extractCursorFromRequest(req);

        // Inject into request
        (req as Request & { pagination: { cursor?: string; limit: number } }).pagination = {
          cursor,
          limit,
        };

        // Call original method
        const result: CursorPaginatedResult<unknown> = await originalMethod.call(this, req, res, next);

        if (res.headersSent) {
          return;
        }

        // Build meta
        const formattedReq = req as FormattedRequest;
        const meta: ResponseMeta = { ...options.meta };

        if (formattedReq.requestId) {
          meta.requestId = formattedReq.requestId;
        }
        if (formattedReq.correlationId) {
          meta.correlationId = formattedReq.correlationId;
        }

        // Get base URL
        const baseUrl = options.includeLinks
          ? `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`
          : undefined;

        // Format response
        const response = formatter.formatCursorPaginated(
          result.data,
          {
            limit,
            cursor,
            nextCursor: result.nextCursor,
            previousCursor: result.previousCursor,
            hasMore: result.hasMore,
          },
          Object.keys(meta).length > 0 ? meta : undefined,
          baseUrl
        );

        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    };

    return descriptor;
  };
}
