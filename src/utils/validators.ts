import type { FormatterConfig, FormatterConfigInput, PaginationConfig } from '../types/config';
import type { PaginationMeta, CursorPaginationMeta } from '../types/responses';

/**
 * Pagination input for offset-based pagination
 */
export interface PaginationInput {
  page: number;
  limit: number;
  total: number;
}

/**
 * Cursor pagination input
 */
export interface CursorPaginationInput {
  limit: number;
  cursor?: string;
  nextCursor?: string;
  previousCursor?: string;
  hasMore: boolean;
}

/**
 * Validate and normalize pagination input
 */
export function validatePaginationInput(
  input: Partial<PaginationInput>,
  config: PaginationConfig
): PaginationInput {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const limit = Math.min(
    config.maxLimit,
    Math.max(1, Math.floor(Number(input.limit) || config.defaultLimit))
  );
  const total = Math.max(0, Math.floor(Number(input.total) || 0));

  return { page, limit, total };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(
  input: PaginationInput,
  baseUrl?: string
): PaginationMeta {
  const { page, limit, total } = input;
  const totalPages = Math.ceil(total / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };

  if (baseUrl) {
    meta.links = generatePaginationLinks(page, totalPages, limit, baseUrl);
  }

  return meta;
}

/**
 * Generate HATEOAS-style pagination links
 */
export function generatePaginationLinks(
  page: number,
  totalPages: number,
  limit: number,
  baseUrl: string
): PaginationMeta['links'] {
  const url = new URL(baseUrl);
  
  const createLink = (p: number): string => {
    url.searchParams.set('page', String(p));
    url.searchParams.set('limit', String(limit));
    return url.toString();
  };

  const links: PaginationMeta['links'] = {
    self: createLink(page),
    first: createLink(1),
    last: createLink(totalPages),
  };

  if (page < totalPages) {
    links.next = createLink(page + 1);
  }

  if (page > 1) {
    links.previous = createLink(page - 1);
  }

  return links;
}

/**
 * Calculate cursor pagination metadata
 */
export function calculateCursorPaginationMeta(
  input: CursorPaginationInput,
  baseUrl?: string
): CursorPaginationMeta {
  const meta: CursorPaginationMeta = {
    limit: input.limit,
    hasMore: input.hasMore,
  };

  if (input.cursor) {
    meta.cursor = input.cursor;
  }

  if (input.nextCursor) {
    meta.nextCursor = input.nextCursor;
  }

  if (input.previousCursor) {
    meta.previousCursor = input.previousCursor;
  }

  if (baseUrl) {
    meta.links = generateCursorPaginationLinks(input, baseUrl);
  }

  return meta;
}

/**
 * Generate cursor pagination links
 */
export function generateCursorPaginationLinks(
  input: CursorPaginationInput,
  baseUrl: string
): CursorPaginationMeta['links'] {
  const url = new URL(baseUrl);
  
  const createLink = (cursor?: string): string => {
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    } else {
      url.searchParams.delete('cursor');
    }
    url.searchParams.set('limit', String(input.limit));
    return url.toString();
  };

  const links: CursorPaginationMeta['links'] = {
    self: createLink(input.cursor),
  };

  if (input.nextCursor && input.hasMore) {
    links.next = createLink(input.nextCursor);
  }

  if (input.previousCursor) {
    links.previous = createLink(input.previousCursor);
  }

  return links;
}

/**
 * Validate configuration input
 */
export function validateConfig(input: FormatterConfigInput): string[] {
  const errors: string[] = [];

  if (input.environment && !['development', 'staging', 'production', 'test'].includes(input.environment)) {
    errors.push(`Invalid environment: ${input.environment}`);
  }

  if (input.pagination) {
    if (input.pagination.defaultLimit !== undefined && input.pagination.defaultLimit < 1) {
      errors.push('pagination.defaultLimit must be at least 1');
    }
    if (input.pagination.maxLimit !== undefined && input.pagination.maxLimit < 1) {
      errors.push('pagination.maxLimit must be at least 1');
    }
    if (
      input.pagination.defaultLimit !== undefined &&
      input.pagination.maxLimit !== undefined &&
      input.pagination.defaultLimit > input.pagination.maxLimit
    ) {
      errors.push('pagination.defaultLimit cannot exceed pagination.maxLimit');
    }
  }

  return errors;
}

/**
 * Check if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
