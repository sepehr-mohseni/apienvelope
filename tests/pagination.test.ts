import { describe, it, expect, beforeEach } from 'vitest';
import { PaginationHelper, createPaginationHelper } from '../src';

describe('PaginationHelper', () => {
  let helper: PaginationHelper;

  beforeEach(() => {
    helper = createPaginationHelper({
      defaultLimit: 10,
      maxLimit: 100,
      includeLinks: false,
    });
  });

  describe('calculateOffset', () => {
    it('should calculate correct offset for page 1', () => {
      expect(helper.calculateOffset(1, 10)).toBe(0);
    });

    it('should calculate correct offset for page 2', () => {
      expect(helper.calculateOffset(2, 10)).toBe(10);
    });

    it('should calculate correct offset for page 5 with limit 20', () => {
      expect(helper.calculateOffset(5, 20)).toBe(80);
    });
  });

  describe('buildMeta', () => {
    it('should build correct pagination meta', () => {
      const meta = helper.buildMeta({ page: 2, limit: 10, total: 45 });

      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(10);
      expect(meta.total).toBe(45);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('should handle first page', () => {
      const meta = helper.buildMeta({ page: 1, limit: 10, total: 45 });

      expect(meta.hasPreviousPage).toBe(false);
      expect(meta.hasNextPage).toBe(true);
    });

    it('should handle last page', () => {
      const meta = helper.buildMeta({ page: 5, limit: 10, total: 45 });

      expect(meta.hasPreviousPage).toBe(true);
      expect(meta.hasNextPage).toBe(false);
    });

    it('should handle empty dataset', () => {
      const meta = helper.buildMeta({ page: 1, limit: 10, total: 0 });

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it('should handle single page', () => {
      const meta = helper.buildMeta({ page: 1, limit: 10, total: 5 });

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });
  });

  describe('buildMeta with links', () => {
    it('should include links when configured', () => {
      const linkHelper = createPaginationHelper({
        includeLinks: true,
        baseUrl: 'http://api.example.com/items',
      });

      const meta = linkHelper.buildMeta({ page: 2, limit: 10, total: 45 });

      expect(meta.links).toBeDefined();
      expect(meta.links?.self).toContain('page=2');
      expect(meta.links?.first).toContain('page=1');
      expect(meta.links?.last).toContain('page=5');
      expect(meta.links?.next).toContain('page=3');
      expect(meta.links?.previous).toContain('page=1');
    });

    it('should not include next link on last page', () => {
      const linkHelper = createPaginationHelper({
        includeLinks: true,
        baseUrl: 'http://api.example.com/items',
      });

      const meta = linkHelper.buildMeta({ page: 5, limit: 10, total: 45 });

      expect(meta.links?.next).toBeUndefined();
    });

    it('should not include previous link on first page', () => {
      const linkHelper = createPaginationHelper({
        includeLinks: true,
        baseUrl: 'http://api.example.com/items',
      });

      const meta = linkHelper.buildMeta({ page: 1, limit: 10, total: 45 });

      expect(meta.links?.previous).toBeUndefined();
    });
  });

  describe('paginateArray', () => {
    it('should paginate array correctly', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const result = helper.paginateArray(items, 2, 10);

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(11);
      expect(result.pagination.total).toBe(25);
    });

    it('should handle last page with fewer items', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const result = helper.paginateArray(items, 3, 10);

      expect(result.data).toHaveLength(5);
      expect(result.data[0].id).toBe(21);
    });

    it('should handle empty array', () => {
      const result = helper.paginateArray([], 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('validation helpers', () => {
    it('should validate page within bounds', () => {
      expect(helper.isValidPage(1, 50, 10)).toBe(true);
      expect(helper.isValidPage(5, 50, 10)).toBe(true);
      expect(helper.isValidPage(6, 50, 10)).toBe(false);
      expect(helper.isValidPage(0, 50, 10)).toBe(false);
    });

    it('should handle empty dataset validation', () => {
      expect(helper.isValidPage(1, 0, 10)).toBe(true);
      expect(helper.isValidPage(2, 0, 10)).toBe(false);
    });

    it('should calculate total pages correctly', () => {
      expect(helper.getTotalPages(50, 10)).toBe(5);
      expect(helper.getTotalPages(51, 10)).toBe(6);
      expect(helper.getTotalPages(0, 10)).toBe(1);
    });
  });

  describe('cursor pagination', () => {
    it('should build cursor pagination meta', () => {
      const meta = helper.buildCursorMeta({
        limit: 10,
        cursor: 'abc123',
        nextCursor: 'def456',
        hasMore: true,
      });

      expect(meta.limit).toBe(10);
      expect(meta.cursor).toBe('abc123');
      expect(meta.nextCursor).toBe('def456');
      expect(meta.hasMore).toBe(true);
    });

    it('should handle no more results', () => {
      const meta = helper.buildCursorMeta({
        limit: 10,
        cursor: 'abc123',
        hasMore: false,
      });

      expect(meta.hasMore).toBe(false);
      expect(meta.nextCursor).toBeUndefined();
    });
  });
});
