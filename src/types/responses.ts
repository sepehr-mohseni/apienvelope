/**
 * Base response interface with common fields
 */
interface BaseResponse {
  timestamp: string;
  meta?: ResponseMeta;
}

/**
 * Metadata that can be attached to any response
 */
export interface ResponseMeta {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Successful response structure
 * @template T - The type of the data payload
 */
export interface SuccessResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T;
}

/**
 * Error details structure
 */
export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  fields?: FieldErrors;
}

/**
 * Field-level validation errors
 */
export interface FieldErrors {
  [field: string]: string | string[];
}

/**
 * Error response structure
 */
export interface ErrorResponse extends BaseResponse {
  success: false;
  error: ErrorDetails;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  links?: PaginationLinks;
}

/**
 * HATEOAS-style pagination links
 */
export interface PaginationLinks {
  self?: string;
  first?: string;
  last?: string;
  next?: string;
  previous?: string;
}

/**
 * Cursor-based pagination metadata
 */
export interface CursorPaginationMeta {
  limit: number;
  cursor?: string;
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
  links?: PaginationLinks;
}

/**
 * Paginated response structure (offset-based)
 * @template T - The type of items in the data array
 */
export interface PaginatedResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Cursor-paginated response structure
 * @template T - The type of items in the data array
 */
export interface CursorPaginatedResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T[];
  pagination: CursorPaginationMeta;
}

/**
 * Discriminated union for type-safe response handling
 * @template T - The type of the data payload for success responses
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Discriminated union for paginated responses
 * @template T - The type of items in the data array
 */
export type PaginatedApiResponse<T = unknown> = PaginatedResponse<T> | ErrorResponse;

/**
 * Type guard for success responses
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard for error responses
 */
export function isErrorResponse(response: ApiResponse<unknown>): response is ErrorResponse {
  return response.success === false;
}

/**
 * Type guard for paginated responses
 */
export function isPaginatedResponse<T>(
  response: PaginatedApiResponse<T>
): response is PaginatedResponse<T> {
  return response.success === true && 'pagination' in response;
}
