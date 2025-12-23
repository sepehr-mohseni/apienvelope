import type {
  SuccessResponse,
  ErrorResponse,
  PaginatedResponse,
  CursorPaginatedResponse,
  ResponseMeta,
} from '../types/responses';
import type { FormatterConfig, FormatterConfigInput } from '../types/config';
import { defaultConfig } from '../types/config';
import { serializeError } from '../utils/errorSerializer';
import { StatusCodeMapper } from '../utils/statusCodeMapper';
import {
  validatePaginationInput,
  calculatePaginationMeta,
  calculateCursorPaginationMeta,
  generateRequestId,
} from '../utils/validators';
import type { PaginationInput, CursorPaginationInput } from '../utils/validators';

/**
 * Core response formatter class
 * Handles formatting of success, error, and paginated responses
 */
export class ResponseFormatter {
  private config: FormatterConfig;
  private statusCodeMapper: StatusCodeMapper;

  constructor(config: FormatterConfigInput = {}) {
    this.config = this.mergeConfig(config);
    this.statusCodeMapper = new StatusCodeMapper(this.config.customErrorMappers);
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(input: FormatterConfigInput): FormatterConfig {
    return {
      ...defaultConfig,
      ...input,
      pagination: {
        ...defaultConfig.pagination,
        ...input.pagination,
      },
      preResponseHooks: input.preResponseHooks || defaultConfig.preResponseHooks,
      postResponseHooks: input.postResponseHooks || defaultConfig.postResponseHooks,
      sensitiveFields: input.sensitiveFields || defaultConfig.sensitiveFields,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<FormatterConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: FormatterConfigInput): void {
    this.config = this.mergeConfig({ ...this.config, ...config });
    if (config.customErrorMappers) {
      this.statusCodeMapper = new StatusCodeMapper(config.customErrorMappers);
    }
  }

  /**
   * Generate timestamp
   */
  private getTimestamp(): string {
    return this.config.includeTimestamp ? new Date().toISOString() : '';
  }

  /**
   * Apply pre-response hooks
   */
  private applyPreHooks(data: unknown, meta?: ResponseMeta): { data: unknown; meta: ResponseMeta | undefined } {
    let result: { data: unknown; meta: ResponseMeta | undefined } = { data, meta };
    for (const hook of this.config.preResponseHooks) {
      const hookResult = hook(result.data, result.meta);
      result = { data: hookResult.data, meta: hookResult.meta };
    }
    return result;
  }

  /**
   * Apply post-response hooks
   */
  private applyPostHooks<T extends SuccessResponse<unknown> | ErrorResponse>(response: T): T {
    let result: SuccessResponse<unknown> | ErrorResponse = response;
    for (const hook of this.config.postResponseHooks) {
      result = hook(result);
    }
    return result as T;
  }

  /**
   * Format a success response
   */
  formatSuccess<T>(data: T, meta?: ResponseMeta): SuccessResponse<T> {
    const processed = this.applyPreHooks(data, meta);
    
    const response: SuccessResponse<T> = {
      success: true,
      data: processed.data as T,
      timestamp: this.getTimestamp(),
    };

    if (processed.meta && Object.keys(processed.meta).length > 0) {
      response.meta = processed.meta;
    }

    // Apply custom formatter if in passthrough mode
    if (this.config.passthroughMode && this.config.customFormatter) {
      return this.config.customFormatter(response) as unknown as SuccessResponse<T>;
    }

    return this.applyPostHooks(response);
  }

  /**
   * Format an error response
   */
  formatError(error: Error, meta?: ResponseMeta): ErrorResponse {
    const includeStack =
      this.config.includeStackTraces ||
      this.config.environment === 'development';

    const errorDetails = serializeError(error, {
      includeStack,
      maskSensitiveData: this.config.maskSensitiveData,
      sensitiveFields: this.config.sensitiveFields,
      customSerializers: this.config.customSerializers,
    });

    const response: ErrorResponse = {
      success: false,
      error: errorDetails,
      timestamp: this.getTimestamp(),
    };

    if (meta && Object.keys(meta).length > 0) {
      response.meta = meta;
    }

    // Apply custom formatter if in passthrough mode
    if (this.config.passthroughMode && this.config.customFormatter) {
      return this.config.customFormatter(response) as unknown as ErrorResponse;
    }

    return this.applyPostHooks(response);
  }

  /**
   * Format a paginated response (offset-based)
   */
  formatPaginated<T>(
    data: T[],
    paginationInput: Partial<PaginationInput>,
    meta?: ResponseMeta,
    baseUrl?: string
  ): PaginatedResponse<T> {
    const processed = this.applyPreHooks(data, meta);
    const validatedInput = validatePaginationInput(paginationInput, this.config.pagination);
    const paginationMeta = calculatePaginationMeta(
      validatedInput,
      this.config.pagination.includeLinks ? baseUrl : undefined
    );

    const response: PaginatedResponse<T> = {
      success: true,
      data: processed.data as T[],
      pagination: paginationMeta,
      timestamp: this.getTimestamp(),
    };

    if (processed.meta && Object.keys(processed.meta).length > 0) {
      response.meta = processed.meta;
    }

    return this.applyPostHooks(response) as PaginatedResponse<T>;
  }

  /**
   * Format a cursor-paginated response
   */
  formatCursorPaginated<T>(
    data: T[],
    cursorInput: CursorPaginationInput,
    meta?: ResponseMeta,
    baseUrl?: string
  ): CursorPaginatedResponse<T> {
    const processed = this.applyPreHooks(data, meta);
    const paginationMeta = calculateCursorPaginationMeta(
      cursorInput,
      this.config.pagination.includeLinks ? baseUrl : undefined
    );

    const response: CursorPaginatedResponse<T> = {
      success: true,
      data: processed.data as T[],
      pagination: paginationMeta,
      timestamp: this.getTimestamp(),
    };

    if (processed.meta && Object.keys(processed.meta).length > 0) {
      response.meta = processed.meta;
    }

    return this.applyPostHooks(response) as CursorPaginatedResponse<T>;
  }

  /**
   * Get status code for an error
   */
  getErrorStatusCode(error: Error): number {
    return this.statusCodeMapper.getStatusCode(error);
  }

  /**
   * Get success status code based on HTTP method
   */
  getSuccessStatusCode(method: string, hasData: boolean): number {
    return this.statusCodeMapper.getSuccessStatusCode(method, hasData);
  }

  /**
   * Generate or extract request ID
   */
  getRequestId(existingId?: string): string {
    if (existingId) {
      return existingId;
    }
    return this.config.generateRequestId ? generateRequestId() : '';
  }
}

/**
 * Create a response formatter instance
 */
export function createResponseFormatter(config?: FormatterConfigInput): ResponseFormatter {
  return new ResponseFormatter(config);
}
