import { ApiError } from './ApiError';
import type { ApiErrorOptions, ErrorContext } from '../types/errors';
import type { FieldErrors } from '../types/responses';

/**
 * Validation Error - 400 Bad Request
 * Used for input validation failures
 */
export class ValidationError extends ApiError {
  constructor(
    message = 'Validation failed',
    fields?: FieldErrors,
    options: Omit<ApiErrorOptions, 'code' | 'statusCode' | 'fields'> = {}
  ) {
    super(message, {
      ...options,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      fields,
    });
  }
}

/**
 * Not Found Error - 404
 * Used when a requested resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(
    message = 'Resource not found',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }
}

/**
 * Unauthorized Error - 401
 * Used when authentication is required but not provided or invalid
 */
export class UnauthorizedError extends ApiError {
  constructor(
    message = 'Authentication required',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }
}

/**
 * Forbidden Error - 403
 * Used when user is authenticated but lacks permission
 */
export class ForbiddenError extends ApiError {
  constructor(
    message = 'Access forbidden',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  }
}

/**
 * Conflict Error - 409
 * Used for resource conflicts (e.g., duplicate entries)
 */
export class ConflictError extends ApiError {
  constructor(
    message = 'Resource conflict',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'CONFLICT',
      statusCode: 409,
    });
  }
}

/**
 * Internal Server Error - 500
 * Used for unexpected server errors
 */
export class InternalServerError extends ApiError {
  constructor(
    message = 'Internal server error',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      isOperational: false,
    });
  }
}

/**
 * Bad Request Error - 400
 * Used for malformed requests
 */
export class BadRequestError extends ApiError {
  constructor(
    message = 'Bad request',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'BAD_REQUEST',
      statusCode: 400,
    });
  }
}

/**
 * Rate Limit Error - 429
 * Used when rate limiting is triggered
 */
export class RateLimitError extends ApiError {
  public readonly retryAfter?: number;

  constructor(
    message = 'Rate limit exceeded',
    retryAfter?: number,
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: retryAfter ? { retryAfter } : undefined,
    });
    this.retryAfter = retryAfter;
  }
}

/**
 * Service Unavailable Error - 503
 * Used when service is temporarily unavailable
 */
export class ServiceUnavailableError extends ApiError {
  constructor(
    message = 'Service temporarily unavailable',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    });
  }
}

/**
 * Unprocessable Entity Error - 422
 * Used when request is valid but cannot be processed
 */
export class UnprocessableEntityError extends ApiError {
  constructor(
    message = 'Unprocessable entity',
    options: Omit<ApiErrorOptions, 'code' | 'statusCode'> = {}
  ) {
    super(message, {
      ...options,
      code: 'UNPROCESSABLE_ENTITY',
      statusCode: 422,
    });
  }
}

/**
 * Factory function to create ApiError with context
 */
export function createError(
  ErrorClass: new (message: string, ...args: unknown[]) => ApiError,
  message: string,
  context?: ErrorContext
): ApiError {
  const error = new ErrorClass(message);
  return context ? error.withContext(context) : error;
}
