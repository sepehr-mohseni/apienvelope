// Core exports
export {
  ResponseFormatter,
  createResponseFormatter,
  ErrorHandler,
  createErrorHandler,
  errorHandlerMiddleware,
  PaginationHelper,
  createPaginationHelper,
  type ErrorHandlerOptions,
} from './core';

// Error exports
export {
  ApiError,
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
  createError,
} from './errors';

// Middleware exports
export {
  responseWrapper,
  createResponseWrapper,
  errorCatcher,
  createErrorCatcher,
  asyncHandler,
  catchErrors,
  type FormattedResponse,
  type FormattedRequest,
  type ResponseWrapperOptions,
  type ErrorCatcherOptions,
} from './middleware';

// Decorator exports
export {
  createResponseDecorator,
  HandleErrors,
  ApiRoute,
  Validate,
  Paginate,
  CursorPaginate,
  type ResponseDecoratorOptions,
  type PaginateDecoratorOptions,
  type PaginatedResult,
  type CursorPaginatedResult,
} from './decorators';

// Type exports
export type {
  // Response types
  SuccessResponse,
  ErrorResponse,
  PaginatedResponse,
  CursorPaginatedResponse,
  ApiResponse,
  PaginatedApiResponse,
  ResponseMeta,
  ErrorDetails,
  FieldErrors,
  PaginationMeta,
  CursorPaginationMeta,
  PaginationLinks,
  // Error types
  ErrorConstructor,
  ErrorSerializer,
  ErrorContext,
  ApiErrorOptions,
  SerializedError,
  ErrorChainItem,
  ErrorCode,
  // Config types
  Environment,
  FormatterConfig,
  FormatterConfigInput,
  PaginationConfig,
  PreResponseHook,
  PostResponseHook,
  CustomFormatter,
} from './types';

// Type guards
export { isSuccessResponse, isErrorResponse, isPaginatedResponse } from './types/responses';

// Error codes constant
export { ErrorCodes } from './types/errors';

// Default config
export { defaultConfig } from './types/config';

// Utility exports
export {
  StatusCodeMapper,
  createStatusCodeMapper,
  serializeError,
  extractFieldErrors,
  extractErrorContext,
  createErrorSerializer,
  validatePaginationInput,
  calculatePaginationMeta,
  generatePaginationLinks,
  calculateCursorPaginationMeta,
  generateCursorPaginationLinks,
  validateConfig,
  isPlainObject,
  generateRequestId,
  type SerializationOptions,
  type PaginationInput,
  type CursorPaginationInput,
} from './utils';

// Convenience function for quick setup
import { responseWrapper, type ResponseWrapperOptions } from './middleware';
import { errorCatcher, type ErrorCatcherOptions } from './middleware';
import type { RequestHandler, ErrorRequestHandler } from 'express';

/**
 * Quick setup function that returns both middleware
 * @example
 * const { wrapper, errorHandler } = responseFormatter({ environment: 'production' });
 * app.use(wrapper);
 * // ... routes
 * app.use(errorHandler);
 */
export function responseFormatter(
  options: ResponseWrapperOptions & ErrorCatcherOptions = {}
): { wrapper: RequestHandler; errorHandler: ErrorRequestHandler } {
  return {
    wrapper: responseWrapper(options),
    errorHandler: errorCatcher(options),
  };
}

// Default export
export default responseFormatter;
