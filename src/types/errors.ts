import type { FieldErrors } from './responses';

/**
 * Error constructor type for mapping
 */
export type ErrorConstructor = new (...args: any[]) => Error;

/**
 * Error serializer function type
 */
export type ErrorSerializer = (error: Error) => Record<string, unknown>;

/**
 * Error context for traceability
 */
export interface ErrorContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  path?: string;
  method?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * API Error options
 */
export interface ApiErrorOptions {
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  fields?: FieldErrors;
  cause?: Error;
  context?: ErrorContext;
  isOperational?: boolean;
}

/**
 * Serialized error structure
 */
export interface SerializedError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  fields?: FieldErrors;
  stack?: string;
  context?: ErrorContext;
}

/**
 * Error chain item for nested errors
 */
export interface ErrorChainItem {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

/**
 * Default error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
