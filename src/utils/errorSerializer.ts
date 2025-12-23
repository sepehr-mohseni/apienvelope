import { ApiError } from '../errors/ApiError';
import type { ErrorConstructor, ErrorSerializer, ErrorContext } from '../types/errors';
import type { ErrorDetails, FieldErrors } from '../types/responses';

/**
 * Options for error serialization
 */
export interface SerializationOptions {
  includeStack: boolean;
  maskSensitiveData: boolean;
  sensitiveFields: string[];
  customSerializers?: Map<ErrorConstructor, ErrorSerializer>;
}

/**
 * Default serialization options
 */
const defaultOptions: SerializationOptions = {
  includeStack: false,
  maskSensitiveData: true,
  sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'authorization'],
};

/**
 * Mask sensitive data in an object
 */
function maskSensitiveFields(
  obj: Record<string, unknown>,
  sensitiveFields: string[]
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  const lowerSensitiveFields = sensitiveFields.map((f) => f.toLowerCase());

  for (const [key, value] of Object.entries(obj)) {
    if (lowerSensitiveFields.includes(key.toLowerCase())) {
      masked[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      masked[key] = maskSensitiveFields(value as Record<string, unknown>, sensitiveFields);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Safely serialize error details handling circular references
 */
function safeSerializeDetails(
  details: Record<string, unknown>,
  seen = new WeakSet<object>()
): Record<string, unknown> {
  if (seen.has(details)) {
    return { _circular: true };
  }
  seen.add(details);

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object') {
      if (value instanceof Error) {
        result[key] = {
          name: value.name,
          message: value.message,
        };
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? safeSerializeDetails(item as Record<string, unknown>, seen)
            : item
        );
      } else {
        result[key] = safeSerializeDetails(value as Record<string, unknown>, seen);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Serialize an error to ErrorDetails format
 */
export function serializeError(
  error: Error,
  options: Partial<SerializationOptions> = {}
): ErrorDetails {
  const opts = { ...defaultOptions, ...options };

  // Check for custom serializer
  if (opts.customSerializers) {
    for (const [ErrorClass, serializer] of opts.customSerializers) {
      if (error instanceof ErrorClass) {
        const customResult = serializer(error);
        return {
          code: (customResult.code as string) || 'CUSTOM_ERROR',
          message: (customResult.message as string) || error.message,
          details: opts.maskSensitiveData
            ? maskSensitiveFields(customResult, opts.sensitiveFields)
            : customResult,
        };
      }
    }
  }

  // Handle ApiError
  if (error instanceof ApiError) {
    const serialized = error.serialize(opts.includeStack);
    
    let details = serialized.details;
    if (details && opts.maskSensitiveData) {
      details = maskSensitiveFields(
        safeSerializeDetails(details),
        opts.sensitiveFields
      ) as Record<string, unknown>;
    }

    const result: ErrorDetails = {
      code: serialized.code,
      message: serialized.message,
    };

    if (details && Object.keys(details).length > 0) {
      result.details = details;
    }

    if (serialized.fields) {
      result.fields = serialized.fields;
    }

    if (opts.includeStack && serialized.stack) {
      result.stack = serialized.stack;
    }

    return result;
  }

  // Handle standard Error
  const result: ErrorDetails = {
    code: 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
  };

  if (opts.includeStack && error.stack) {
    result.stack = error.stack;
  }

  return result;
}

/**
 * Extract field errors from validation error
 */
export function extractFieldErrors(error: Error): FieldErrors | undefined {
  if (error instanceof ApiError && error.fields) {
    return error.fields;
  }
  return undefined;
}

/**
 * Extract error context
 */
export function extractErrorContext(error: Error): ErrorContext | undefined {
  if (error instanceof ApiError && error.context) {
    return error.context;
  }
  return undefined;
}

/**
 * Create error serializer with options
 */
export function createErrorSerializer(
  options: Partial<SerializationOptions> = {}
): (error: Error) => ErrorDetails {
  const opts = { ...defaultOptions, ...options };
  return (error: Error) => serializeError(error, opts);
}
