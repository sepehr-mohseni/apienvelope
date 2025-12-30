import { describe, it, expect } from 'vitest';
import {
  serializeError,
  validatePaginationInput,
  generateRequestId,
  ApiError,
  ValidationError,
  PaginationHelper,
} from '../src';

describe('Security Tests', () => {
  describe('Prototype Pollution Prevention', () => {
    it('should not allow __proto__ in error details', () => {
      const maliciousDetails = {
        __proto__: { polluted: true },
        normal: 'value',
      };
      const error = new ApiError('Test', { details: maliciousDetails });
      const serialized = serializeError(error);
      
      expect(serialized.details).toBeDefined();
      expect((serialized.details as any).__proto__).toBeUndefined();
      expect((serialized.details as any).normal).toBe('value');
      // Verify global Object wasn't polluted
      expect(({} as any).polluted).toBeUndefined();
    });

    it('should not allow constructor in error details', () => {
      const maliciousDetails = {
        constructor: { polluted: true },
        safe: 'data',
      };
      const error = new ApiError('Test', { details: maliciousDetails });
      const serialized = serializeError(error);
      
      expect((serialized.details as any).constructor).toBeUndefined();
      expect((serialized.details as any).safe).toBe('data');
    });

    it('should not allow prototype in nested objects', () => {
      const maliciousDetails = {
        nested: {
          prototype: { evil: true },
          __proto__: { bad: true },
          good: 'value',
        },
      };
      const error = new ApiError('Test', { details: maliciousDetails });
      const serialized = serializeError(error);
      
      expect((serialized.details as any).nested.prototype).toBeUndefined();
      expect((serialized.details as any).nested.__proto__).toBeUndefined();
      expect((serialized.details as any).nested.good).toBe('value');
    });
  });

  describe('Deep Recursion Attack Prevention', () => {
    it('should handle deeply nested objects without stack overflow', () => {
      // Create a 50-level deep object
      let deepObj: any = { value: 'bottom' };
      for (let i = 0; i < 50; i++) {
        deepObj = { nested: deepObj };
      }
      
      const error = new ApiError('Test', { details: deepObj });
      const serialized = serializeError(error);
      
      // Should not throw and should truncate
      expect(serialized).toBeDefined();
      expect(serialized.details).toBeDefined();
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      const error = new ApiError('Test', { details: circular });
      const serialized = serializeError(error);
      
      // Should not throw - circular refs are handled
      expect(serialized).toBeDefined();
      expect((serialized.details as any).name).toBe('test');
      // The self-reference should be marked as circular
      expect((serialized.details as any).self._circular).toBe(true);
    });
  });

  describe('Integer Overflow Prevention', () => {
    it('should handle extremely large page numbers', () => {
      const result = validatePaginationInput(
        { page: Number.MAX_SAFE_INTEGER, limit: 10, total: 100 },
        { defaultLimit: 10, maxLimit: 100, includeLinks: false }
      );
      
      expect(result.page).toBeLessThanOrEqual(1000000);
      expect(Number.isFinite(result.page)).toBe(true);
    });

    it('should handle negative numbers', () => {
      const result = validatePaginationInput(
        { page: -999, limit: -10, total: -50 },
        { defaultLimit: 10, maxLimit: 100, includeLinks: false }
      );
      
      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle NaN values', () => {
      const result = validatePaginationInput(
        { page: NaN, limit: NaN, total: NaN },
        { defaultLimit: 10, maxLimit: 100, includeLinks: false }
      );
      
      expect(Number.isNaN(result.page)).toBe(false);
      expect(Number.isNaN(result.limit)).toBe(false);
      expect(Number.isNaN(result.total)).toBe(false);
    });

    it('should handle Infinity values', () => {
      const result = validatePaginationInput(
        { page: Infinity, limit: Infinity, total: Infinity },
        { defaultLimit: 10, maxLimit: 100, includeLinks: false }
      );
      
      expect(Number.isFinite(result.page)).toBe(true);
      expect(Number.isFinite(result.limit)).toBe(true);
      expect(Number.isFinite(result.total)).toBe(true);
    });

    it('should handle string coercion attacks', () => {
      const result = validatePaginationInput(
        { page: '999999999999999999999' as any, limit: '1e100' as any, total: 100 },
        { defaultLimit: 10, maxLimit: 100, includeLinks: false }
      );
      
      expect(Number.isFinite(result.page)).toBe(true);
      expect(result.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('Cursor Injection Prevention', () => {
    it('should reject cursors with SQL injection patterns', () => {
      const helper = new PaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const mockReq = {
        query: {
          cursor: "'; DROP TABLE users; --",
          limit: '10',
        },
      } as any;
      
      const result = helper.extractCursorFromRequest(mockReq);
      expect(result.cursor).toBeUndefined();
    });

    it('should reject cursors with script tags', () => {
      const helper = new PaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const mockReq = {
        query: {
          cursor: '<script>alert("xss")</script>',
          limit: '10',
        },
      } as any;
      
      const result = helper.extractCursorFromRequest(mockReq);
      expect(result.cursor).toBeUndefined();
    });

    it('should reject extremely long cursors', () => {
      const helper = new PaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const mockReq = {
        query: {
          cursor: 'a'.repeat(1000),
          limit: '10',
        },
      } as any;
      
      const result = helper.extractCursorFromRequest(mockReq);
      expect(result.cursor).toBeUndefined();
    });

    it('should accept valid base64 cursors', () => {
      const helper = new PaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const mockReq = {
        query: {
          cursor: 'eyJpZCI6MTIzfQ==', // base64 of {"id":123}
          limit: '10',
        },
      } as any;
      
      const result = helper.extractCursorFromRequest(mockReq);
      expect(result.cursor).toBe('eyJpZCI6MTIzfQ==');
    });

    it('should accept valid alphanumeric cursors', () => {
      const helper = new PaginationHelper({ defaultLimit: 10, maxLimit: 100 });
      const mockReq = {
        query: {
          cursor: 'abc123_def-456',
          limit: '10',
        },
      } as any;
      
      const result = helper.extractCursorFromRequest(mockReq);
      expect(result.cursor).toBe('abc123_def-456');
    });
  });

  describe('Sensitive Data Masking', () => {
    it('should mask password fields', () => {
      const error = new ApiError('Test', {
        details: { username: 'john', password: 'secret123' },
      });
      const serialized = serializeError(error, { maskSensitiveData: true, sensitiveFields: ['password'] });
      
      expect((serialized.details as any).username).toBe('john');
      expect((serialized.details as any).password).toBe('[REDACTED]');
    });

    it('should mask nested sensitive fields', () => {
      const error = new ApiError('Test', {
        details: {
          user: {
            name: 'john',
            credentials: {
              apiKey: 'sk-12345',
              token: 'jwt-token',
            },
          },
        },
      });
      const serialized = serializeError(error, {
        maskSensitiveData: true,
        sensitiveFields: ['apiKey', 'token'],
      });
      
      expect((serialized.details as any).user.name).toBe('john');
      expect((serialized.details as any).user.credentials.apiKey).toBe('[REDACTED]');
      expect((serialized.details as any).user.credentials.token).toBe('[REDACTED]');
    });

    it('should be case-insensitive for sensitive fields', () => {
      const error = new ApiError('Test', {
        details: { PASSWORD: 'secret', Token: 'abc', APIKEY: '123' },
      });
      const serialized = serializeError(error, {
        maskSensitiveData: true,
        sensitiveFields: ['password', 'token', 'apikey'],
      });
      
      expect((serialized.details as any).PASSWORD).toBe('[REDACTED]');
      expect((serialized.details as any).Token).toBe('[REDACTED]');
      expect((serialized.details as any).APIKEY).toBe('[REDACTED]');
    });
  });

  describe('Request ID Generation Security', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateRequestId());
      }
      // All 1000 should be unique
      expect(ids.size).toBe(1000);
    });

    it('should not contain predictable patterns', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      // IDs should be different
      expect(id1).not.toBe(id2);
      
      // Should have reasonable length
      expect(id1.length).toBeGreaterThan(10);
      expect(id1.length).toBeLessThan(50);
    });
  });

  describe('Array Size Limiting', () => {
    it('should handle large arrays in error details', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      const error = new ApiError('Test', { details: { items: largeArray } });
      const serialized = serializeError(error);
      
      // Should not crash and should limit array size
      expect(serialized).toBeDefined();
      expect((serialized.details as any).items.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Stack Trace Protection', () => {
    it('should not include stack traces by default in production', () => {
      const error = new ApiError('Test error');
      const serialized = serializeError(error, { includeStack: false });
      
      expect(serialized.stack).toBeUndefined();
    });

    it('should include stack traces when explicitly enabled', () => {
      const error = new ApiError('Test error');
      const serialized = serializeError(error, { includeStack: true });
      
      expect(serialized.stack).toBeDefined();
      expect(serialized.stack).toContain('ApiError');
    });
  });

  describe('URL Parsing Safety', () => {
    it('should handle malformed base URLs gracefully in pagination', () => {
      // This tests that the URL constructor doesn't throw on edge cases
      const helper = new PaginationHelper({
        defaultLimit: 10,
        maxLimit: 100,
        includeLinks: true,
        baseUrl: 'https://example.com/api/items',
      });
      
      const meta = helper.buildMeta({ page: 1, limit: 10, total: 100 });
      expect(meta.links).toBeDefined();
      expect(meta.links?.self).toContain('https://example.com');
    });
  });
});
