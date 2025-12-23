import type { ErrorConstructor, ErrorSerializer } from './errors';
import type { ResponseMeta, SuccessResponse, ErrorResponse } from './responses';

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Response hook function types
 */
export type PreResponseHook = (
  data: unknown,
  meta?: ResponseMeta
) => { data: unknown; meta?: ResponseMeta };

export type PostResponseHook = (
  response: SuccessResponse<unknown> | ErrorResponse
) => SuccessResponse<unknown> | ErrorResponse;

/**
 * Custom formatter function type
 */
export type CustomFormatter = (
  response: SuccessResponse<unknown> | ErrorResponse
) => Record<string, unknown>;

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  includeLinks: boolean;
  baseUrl?: string;
}

/**
 * Main formatter configuration
 */
export interface FormatterConfig {
  /** Include stack traces in error responses */
  includeStackTraces: boolean;
  
  /** Current environment */
  environment: Environment;
  
  /** Custom error to status code mappings */
  customErrorMappers?: Map<ErrorConstructor, number>;
  
  /** Custom error serializers */
  customSerializers?: Map<ErrorConstructor, ErrorSerializer>;
  
  /** Include timestamp in responses */
  includeTimestamp: boolean;
  
  /** Mask sensitive data in errors */
  maskSensitiveData: boolean;
  
  /** Header name for request ID */
  requestIdHeader: string;
  
  /** Header name for correlation ID */
  correlationIdHeader: string;
  
  /** Pagination configuration */
  pagination: PaginationConfig;
  
  /** Pre-response processing hooks */
  preResponseHooks: PreResponseHook[];
  
  /** Post-response processing hooks */
  postResponseHooks: PostResponseHook[];
  
  /** Custom response formatter (passthrough mode) */
  customFormatter?: CustomFormatter;
  
  /** Enable passthrough mode for backward compatibility */
  passthroughMode: boolean;
  
  /** Sensitive fields to mask in error details */
  sensitiveFields: string[];
  
  /** Generate request ID if not present */
  generateRequestId: boolean;
}

/**
 * Partial configuration for user input
 */
export type FormatterConfigInput = Partial<FormatterConfig>;

/**
 * Default configuration values
 */
export const defaultConfig: FormatterConfig = {
  includeStackTraces: false,
  environment: 'production',
  includeTimestamp: true,
  maskSensitiveData: true,
  requestIdHeader: 'x-request-id',
  correlationIdHeader: 'x-correlation-id',
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
    includeLinks: false,
  },
  preResponseHooks: [],
  postResponseHooks: [],
  passthroughMode: false,
  sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'authorization'],
  generateRequestId: true,
};
