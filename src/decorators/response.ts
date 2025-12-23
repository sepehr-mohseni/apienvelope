import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../core/ResponseFormatter';
import type { ResponseMeta } from '../types/responses';
import type { FormattedRequest } from '../middleware/responseWrapper';

/**
 * Decorator options
 */
export interface ResponseDecoratorOptions {
  /** Status code to use for success response */
  statusCode?: number;
  
  /** Additional metadata to include */
  meta?: ResponseMeta;
  
  /** Skip formatting and return raw response */
  raw?: boolean;
}

/**
 * Create a response decorator factory
 */
export function createResponseDecorator(
  formatter: ResponseFormatter
): (options?: ResponseDecoratorOptions) => MethodDecorator {
  return (options: ResponseDecoratorOptions = {}): MethodDecorator => {
    return (
      _target: object,
      _propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (
        req: Request,
        res: Response,
        next?: NextFunction
      ): Promise<void> {
        try {
          const result = await originalMethod.call(this, req, res, next);

          // Skip if response already sent
          if (res.headersSent) {
            return;
          }

          // Skip formatting if raw option is set
          if (options.raw) {
            res.json(result);
            return;
          }

          // Build meta from request
          const formattedReq = req as FormattedRequest;
          const meta: ResponseMeta = { ...options.meta };

          if (formattedReq.requestId) {
            meta.requestId = formattedReq.requestId;
          }
          if (formattedReq.correlationId) {
            meta.correlationId = formattedReq.correlationId;
          }

          // Format response
          const response = formatter.formatSuccess(result, meta);
          const statusCode =
            options.statusCode ??
            formatter.getSuccessStatusCode(req.method, result !== undefined);

          res.status(statusCode).json(response);
        } catch (error) {
          if (next) {
            next(error);
          } else {
            throw error;
          }
        }
      };

      return descriptor;
    };
  };
}

/**
 * Handle errors decorator
 * Wraps method in try-catch and passes errors to next()
 */
export function HandleErrors(): MethodDecorator {
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
        await originalMethod.call(this, req, res, next);
      } catch (error) {
        next(error);
      }
    };

    return descriptor;
  };
}

/**
 * API Route decorator factory
 * Creates a decorator that handles response formatting and error catching
 */
export function ApiRoute(
  formatter: ResponseFormatter,
  options: ResponseDecoratorOptions = {}
): MethodDecorator {
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
        const result = await originalMethod.call(this, req, res, next);

        if (res.headersSent) {
          return;
        }

        if (options.raw) {
          res.json(result);
          return;
        }

        const formattedReq = req as FormattedRequest;
        const meta: ResponseMeta = { ...options.meta };

        if (formattedReq.requestId) {
          meta.requestId = formattedReq.requestId;
        }
        if (formattedReq.correlationId) {
          meta.correlationId = formattedReq.correlationId;
        }

        const response = formatter.formatSuccess(result, meta);
        const statusCode =
          options.statusCode ??
          formatter.getSuccessStatusCode(req.method, result !== undefined);

        res.status(statusCode).json(response);
      } catch (error) {
        next(error);
      }
    };

    return descriptor;
  };
}

/**
 * Validate decorator
 * Validates request body/params/query before executing handler
 */
export function Validate(
  validator: (data: unknown) => { valid: boolean; errors?: Record<string, string[]> },
  source: 'body' | 'params' | 'query' = 'body'
): MethodDecorator {
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
      const data = req[source];
      const result = validator(data);

      if (!result.valid) {
        const { ValidationError } = await import('../errors/predefined');
        next(new ValidationError('Validation failed', result.errors));
        return;
      }

      await originalMethod.call(this, req, res, next);
    };

    return descriptor;
  };
}
