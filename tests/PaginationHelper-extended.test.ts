import { describe, it, expect } from 'vitest';
import { PaginationHelper, createPaginationHelper } from '../src';

describe('PaginationHelper Extended', () => {
  describe('extractFromRequest', () => {
    it('should extract pagination from request query', () => {
      const helper = createPaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const req = {
        query: { page: '2', limit: '25' },
      } as any;

      const { page, limit } = helper.extractFromRequest(req);
      expect(page).toBe(2);
      expect(limit).toBe(25);
    });

    it('should use defaults for missing params', () => {
      const helper = createPaginationHelper({ defaultLimit: 15, maxLimit: 100 });
      const req = { query: {} } as any;

      const { page, limit } = helper.extractFromRequest(req);
      expect(page).toBe(1);
      expect(limit).toBe(15);
    });

    it('should enforce maxLimit', () => {
      const helper = createPaginationHelper({ defaultLimit: 10, maxLimit: 50 });
      const req = { query: { limit: '100' } } as any;

      const { limit } = helper.extractFromRequest(req);
      expect(limit).toBe(50);
    });

    it('should handle invalid page values', () => {
      const helper = createPaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const req = { query: { page: '-5' } } as any;

      const { page } = helper.extractFromRequest(req);
      expect(page).toBe(1);
    });
  });

  describe('extractCursorFromRequest', () => {
    it('should extract cursor pagination from request', () => {
      const helper = createPaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const req = {
        query: { cursor: 'abc123', limit: '20' },
      } as any;

      const { cursor, limit } = helper.extractCursorFromRequest(req);
      expect(cursor).toBe('abc123');
      expect(limit).toBe(20);
    });

    it('should handle missing cursor', () => {
      const helper = createPaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const req = { query: { limit: '20' } } as any;

      const { cursor, limit } = helper.extractCursorFromRequest(req);
      expect(cursor).toBeUndefined();
      expect(limit).toBe(20);
    });
  });

  describe('fromArray', () => {
    it('should create pagination info from data and total', () => {
      const helper = createPaginationHelper();
      const result = helper.fromArray(
        [{ id: 1 }, { id: 2 }],
        2,
        10,
        50
      );

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  describe('getConfig and updateConfig', () => {
    it('should return current config', () => {
      const helper = createPaginationHelper({
        defaultLimit: 20,
        maxLimit: 200,
        includeLinks: true,
      });

      const config = helper.getConfig();
      expect(config.defaultLimit).toBe(20);
      expect(config.maxLimit).toBe(200);
      expect(config.includeLinks).toBe(true);
    });

    it('should update config', () => {
      const helper = createPaginationHelper({ defaultLimit: 10 });
      helper.updateConfig({ defaultLimit: 25 });

      expect(helper.getConfig().defaultLimit).toBe(25);
    });
  });

  describe('buildCursorMeta with links', () => {
    it('should include links when configured', () => {
      const helper = createPaginationHelper({
        defaultLimit: 10,
        maxLimit: 100,
        includeLinks: true,
        baseUrl: 'http://api.example.com/items',
      });

      const meta = helper.buildCursorMeta({
        limit: 10,
        cursor: 'abc',
        nextCursor: 'def',
        hasMore: true,
      });

      expect(meta.links).toBeDefined();
      expect(meta.links?.self).toContain('cursor=abc');
      expect(meta.links?.next).toContain('cursor=def');
    });
  });

  describe('edge cases', () => {
    it('should handle zero total', () => {
      const helper = createPaginationHelper();
      const meta = helper.buildMeta({ page: 1, limit: 10, total: 0 });

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it('should handle exact page boundary', () => {
      const helper = createPaginationHelper();
      const meta = helper.buildMeta({ page: 5, limit: 10, total: 50 });

      expect(meta.totalPages).toBe(5);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('should paginate empty array', () => {
      const helper = createPaginationHelper();
      const result = helper.paginateArray([], 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle page beyond total', () => {
      const helper = createPaginationHelper();
      const result = helper.paginateArray([1, 2, 3], 10, 10);

      expect(result.data).toHaveLength(0);
    });
  });
});
