import type { ApiErrorOptions, ErrorContext, SerializedError } from '../types/errors';
import type { FieldErrors } from '../types/responses';

/**
 * Base API Error class for all application errors
 * Provides structured error information for consistent API responses
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly fields?: FieldErrors;
  public readonly context?: ErrorContext;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = options.code || 'INTERNAL_ERROR';
    this.statusCode = options.statusCode || 500;
    this.details = options.details;
    this.fields = options.fields;
    this.context = options.context;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);

    // Set cause if provided (ES2022 error cause)
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Serialize error for response
   */
  serialize(includeStack = false): SerializedError {
    const serialized: SerializedError = {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };

    if (this.details) {
      serialized.details = this.details;
    }

    if (this.fields) {
      serialized.fields = this.fields;
    }

    if (this.context) {
      serialized.context = this.context;
    }

    if (includeStack && this.stack) {
      serialized.stack = this.stack;
    }

    return serialized;
  }

  /**
   * Get error chain for nested errors
   */
  getErrorChain(): Array<{ name: string; message: string; code?: string }> {
    const chain: Array<{ name: string; message: string; code?: string }> = [];
    let current: Error | undefined = this;
    const seen = new WeakSet<Error>();

    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push({
        name: current.name,
        message: current.message,
        code: current instanceof ApiError ? current.code : undefined,
      });
      current = current.cause as Error | undefined;
    }

    return chain;
  }

  /**
   * Create a new error with additional context
   */
  withContext(context: ErrorContext): ApiError {
    return new ApiError(this.message, {
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      fields: this.fields,
      context: { ...this.context, ...context },
      cause: this.cause as Error,
      isOperational: this.isOperational,
    });
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      fields: this.fields,
      context: this.context,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}
