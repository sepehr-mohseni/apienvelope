import type { Request } from 'express';
import type { PaginationMeta, CursorPaginationMeta } from '../types/responses';
import type { PaginationConfig } from '../types/config';
import {
  validatePaginationInput,
  calculatePaginationMeta,
  calculateCursorPaginationMeta,
} from '../utils/validators';
import type { PaginationInput, CursorPaginationInput } from '../utils/validators';

/**
 * Pagination helper class for handling pagination logic
 */
export class PaginationHelper {
  private config: PaginationConfig;

  constructor(config: Partial<PaginationConfig> = {}) {
    this.config = {
      defaultLimit: config.defaultLimit ?? 10,
      maxLimit: config.maxLimit ?? 100,
      includeLinks: config.includeLinks ?? false,
      baseUrl: config.baseUrl,
    };
  }

  /**
   * Safely parse integer from query param
   */
  private safeParseInt(value: unknown, fallback: number, max: number): number {
    if (typeof value !== 'string') return fallback;
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(1, num));
  }

  /**
   * Extract pagination parameters from request
   */
  extractFromRequest(req: Request): { page: number; limit: number } {
    const page = this.safeParseInt(req.query.page, 1, 1000000);
    const limit = Math.min(
      this.config.maxLimit,
      this.safeParseInt(req.query.limit, this.config.defaultLimit, this.config.maxLimit)
    );

    return { page, limit };
  }

  /**
   * Validate cursor format (base64 or alphanumeric, max 512 chars)
   */
  private validateCursor(cursor: unknown): string | undefined {
    if (typeof cursor !== 'string' || cursor.length === 0) return undefined;
    if (cursor.length > 512) return undefined;
    // Allow base64 and alphanumeric cursors only
    if (!/^[a-zA-Z0-9+/=_-]+$/.test(cursor)) return undefined;
    return cursor;
  }

  /**
   * Extract cursor pagination parameters from request
   */
  extractCursorFromRequest(req: Request): { cursor?: string; limit: number } {
    const cursor = this.validateCursor(req.query.cursor);
    const limit = Math.min(
      this.config.maxLimit,
      this.safeParseInt(req.query.limit, this.config.defaultLimit, this.config.maxLimit)
    );

    return { cursor, limit };
  }

  /**
   * Calculate offset for database queries
   */
  calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Build pagination metadata
   */
  buildMeta(input: PaginationInput, baseUrl?: string): PaginationMeta {
    const validated = validatePaginationInput(input, this.config);
    return calculatePaginationMeta(
      validated,
      this.config.includeLinks ? (baseUrl || this.config.baseUrl) : undefined
    );
  }

  /**
   * Build cursor pagination metadata
   */
  buildCursorMeta(input: CursorPaginationInput, baseUrl?: string): CursorPaginationMeta {
    return calculateCursorPaginationMeta(
      input,
      this.config.includeLinks ? (baseUrl || this.config.baseUrl) : undefined
    );
  }

  /**
   * Create pagination info from data array and total count
   */
  fromArray<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): { data: T[]; pagination: PaginationMeta } {
    const pagination = this.buildMeta({ page, limit, total });
    return { data, pagination };
  }

  /**
   * Paginate an in-memory array
   */
  paginateArray<T>(
    items: T[],
    page: number,
    limit: number
  ): { data: T[]; pagination: PaginationMeta } {
    const total = items.length;
    const offset = this.calculateOffset(page, limit);
    const data = items.slice(offset, offset + limit);
    
    return this.fromArray(data, page, limit, total);
  }

  /**
   * Check if there are more pages
   */
  hasNextPage(page: number, limit: number, total: number): boolean {
    const totalPages = Math.ceil(total / limit);
    return page < totalPages;
  }

  /**
   * Check if there are previous pages
   */
  hasPreviousPage(page: number): boolean {
    return page > 1;
  }

  /**
   * Get total pages count
   */
  getTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit) || 1;
  }

  /**
   * Validate page number is within bounds
   */
  isValidPage(page: number, total: number, limit: number): boolean {
    if (page < 1) return false;
    if (total === 0) return page === 1;
    const totalPages = this.getTotalPages(total, limit);
    return page <= totalPages;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<PaginationConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a pagination helper instance
 */
export function createPaginationHelper(config?: Partial<PaginationConfig>): PaginationHelper {
  return new PaginationHelper(config);
}
