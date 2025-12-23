import { ApiError } from '../errors/ApiError';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  BadRequestError,
  RateLimitError,
  ServiceUnavailableError,
  UnprocessableEntityError,
} from '../errors/predefined';
import type { ErrorConstructor } from '../types/errors';

/**
 * Default error to status code mappings
 */
const defaultErrorMappings = new Map<ErrorConstructor, number>([
  [ValidationError, 400],
  [BadRequestError, 400],
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [UnprocessableEntityError, 422],
  [RateLimitError, 429],
  [InternalServerError, 500],
  [ServiceUnavailableError, 503],
]);

/**
 * HTTP method to default success status code mapping
 */
const methodStatusCodes: Record<string, number> = {
  GET: 200,
  POST: 201,
  PUT: 200,
  PATCH: 200,
  DELETE: 204,
  HEAD: 200,
  OPTIONS: 200,
};

/**
 * Status code mapper class
 */
export class StatusCodeMapper {
  private customMappings: Map<ErrorConstructor, number>;

  constructor(customMappings?: Map<ErrorConstructor, number>) {
    this.customMappings = customMappings || new Map();
  }

  /**
   * Get status code for an error
   */
  getStatusCode(error: Error): number {
    // Check if it's an ApiError with explicit status code
    if (error instanceof ApiError) {
      return error.statusCode;
    }

    // Check custom mappings first
    for (const [ErrorClass, statusCode] of this.customMappings) {
      if (error instanceof ErrorClass) {
        return statusCode;
      }
    }

    // Check default mappings
    for (const [ErrorClass, statusCode] of defaultErrorMappings) {
      if (error instanceof ErrorClass) {
        return statusCode;
      }
    }

    // Default to 500 for unknown errors
    return 500;
  }

  /**
   * Get success status code based on HTTP method
   */
  getSuccessStatusCode(method: string, hasData: boolean): number {
    const upperMethod = method.toUpperCase();
    
    // No content for DELETE with no data
    if (upperMethod === 'DELETE' && !hasData) {
      return 204;
    }

    return methodStatusCodes[upperMethod] || 200;
  }

  /**
   * Add custom error mapping
   */
  addMapping(ErrorClass: ErrorConstructor, statusCode: number): void {
    this.customMappings.set(ErrorClass, statusCode);
  }

  /**
   * Remove custom error mapping
   */
  removeMapping(ErrorClass: ErrorConstructor): boolean {
    return this.customMappings.delete(ErrorClass);
  }

  /**
   * Check if status code indicates success
   */
  static isSuccessCode(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
  }

  /**
   * Check if status code indicates client error
   */
  static isClientError(statusCode: number): boolean {
    return statusCode >= 400 && statusCode < 500;
  }

  /**
   * Check if status code indicates server error
   */
  static isServerError(statusCode: number): boolean {
    return statusCode >= 500 && statusCode < 600;
  }
}

/**
 * Create a status code mapper with custom mappings
 */
export function createStatusCodeMapper(
  customMappings?: Map<ErrorConstructor, number>
): StatusCodeMapper {
  return new StatusCodeMapper(customMappings);
}
