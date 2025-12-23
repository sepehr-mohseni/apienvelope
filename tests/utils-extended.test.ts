import { describe, it, expect } from 'vitest';
import {
  serializeError,
  createErrorSerializer,
  extractFieldErrors,
  extractErrorContext,
  generatePaginationLinks,
  generateCursorPaginationLinks,
  StatusCodeMapper,
  ApiError,
  ValidationError,
} from '../src';

describe('Utils Extended', () => {
  describe('serializeError extended', () => {
    it('should handle arrays in details', () => {
      const error = new ApiError('Test', {
        code: 'TEST',
        statusCode: 400,
        details: {
          items: [{ id: 1 }, { id: 2 }],
        },
      });

      const serialized = serializeError(error, {
        includeStack: false,
        maskSensitiveData: false,
        sensitiveFields: [],
      });

      expect(serialized.details?.items).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should handle null and undefined in details', () => {
      const error = new ApiError('Test', {
        code: 'TEST',
        statusCode: 400,
        details: {
          nullValue: null,
          undefinedValue: undefined,
        },
      });

      const serialized = serializeError(error, {
        includeStack: false,
        maskSensitiveData: false,
        sensitiveFields: [],
      });

      expect(serialized.details?.nullValue).toBeNull();
      expect(serialized.details?.undefinedValue).toBeUndefined();
    });

    it('should mask nested sensitive fields', () => {
      const error = new ApiError('Test', {
        code: 'TEST',
        statusCode: 400,
        details: {
          user: {
            name: 'John',
            password: 'secret',
          },
        },
      });

      const serialized = serializeError(error, {
        includeStack: false,
        maskSensitiveData: true,
        sensitiveFields: ['password'],
      });

      expect((serialized.details?.user as any).password).toBe('[REDACTED]');
      expect((serialized.details?.user as any).name).toBe('John');
    });

    it('should handle primitive values in details', () => {
      const error = new ApiError('Test', {
        code: 'TEST',
        statusCode: 400,
        details: {
          count: 42,
          active: true,
          name: 'test',
        },
      });

      const serialized = serializeError(error, {
        includeStack: false,
        maskSensitiveData: false,
        sensitiveFields: [],
      });

      expect(serialized.details?.count).toBe(42);
      expect(serialized.details?.active).toBe(true);
      expect(serialized.details?.name).toBe('test');
    });
  });

  describe('createErrorSerializer', () => {
    it('should create a reusable serializer', () => {
      const serialize = createErrorSerializer({
        includeStack: false,
        maskSensitiveData: true,
        sensitiveFields: ['token'],
      });

      const error = new ApiError('Test', {
        code: 'TEST',
        statusCode: 400,
        details: { token: 'abc123' },
      });

      const serialized = serialize(error);
      expect(serialized.details?.token).toBe('[REDACTED]');
    });
  });

  describe('extractFieldErrors', () => {
    it('should extract field errors from ValidationError', () => {
      const error = new ValidationError('Validation failed', {
        email: ['Invalid format'],
        password: ['Too short'],
      });

      const fields = extractFieldErrors(error);
      expect(fields).toEqual({
        email: ['Invalid format'],
        password: ['Too short'],
      });
    });

    it('should return undefined for non-validation errors', () => {
      const error = new Error('Regular error');
      const fields = extractFieldErrors(error);
      expect(fields).toBeUndefined();
    });

    it('should return undefined for ApiError without fields', () => {
      const error = new ApiError('Test', { code: 'TEST' });
      const fields = extractFieldErrors(error);
      expect(fields).toBeUndefined();
    });
  });

  describe('extractErrorContext', () => {
    it('should extract context from ApiError', () => {
      const error = new ApiError('Test', {
        code: 'TEST',
        context: {
          requestId: 'req-123',
          userId: 'user-456',
        },
      });

      const context = extractErrorContext(error);
      expect(context?.requestId).toBe('req-123');
      expect(context?.userId).toBe('user-456');
    });

    it('should return undefined for errors without context', () => {
      const error = new ApiError('Test', { code: 'TEST' });
      const context = extractErrorContext(error);
      expect(context).toBeUndefined();
    });

    it('should return undefined for standard errors', () => {
      const error = new Error('Test');
      const context = extractErrorContext(error);
      expect(context).toBeUndefined();
    });
  });

  describe('generatePaginationLinks', () => {
    it('should generate all links for middle page', () => {
      const links = generatePaginationLinks(3, 10, 20, 'http://api.example.com/items');

      expect(links.self).toContain('page=3');
      expect(links.first).toContain('page=1');
      expect(links.last).toContain('page=10');
      expect(links.next).toContain('page=4');
      expect(links.previous).toContain('page=2');
    });

    it('should not include next on last page', () => {
      const links = generatePaginationLinks(10, 10, 20, 'http://api.example.com/items');

      expect(links.next).toBeUndefined();
      expect(links.previous).toContain('page=9');
    });

    it('should not include previous on first page', () => {
      const links = generatePaginationLinks(1, 10, 20, 'http://api.example.com/items');

      expect(links.previous).toBeUndefined();
      expect(links.next).toContain('page=2');
    });
  });

  describe('generateCursorPaginationLinks', () => {
    it('should generate links with cursors', () => {
      const links = generateCursorPaginationLinks(
        {
          limit: 10,
          cursor: 'current',
          nextCursor: 'next',
          previousCursor: 'prev',
          hasMore: true,
        },
        'http://api.example.com/items'
      );

      expect(links.self).toContain('cursor=current');
      expect(links.next).toContain('cursor=next');
      expect(links.previous).toContain('cursor=prev');
    });

    it('should not include next when hasMore is false', () => {
      const links = generateCursorPaginationLinks(
        {
          limit: 10,
          cursor: 'current',
          nextCursor: 'next',
          hasMore: false,
        },
        'http://api.example.com/items'
      );

      expect(links.next).toBeUndefined();
    });

    it('should handle missing cursors', () => {
      const links = generateCursorPaginationLinks(
        {
          limit: 10,
          hasMore: false,
        },
        'http://api.example.com/items'
      );

      expect(links.self).toBeDefined();
      expect(links.next).toBeUndefined();
      expect(links.previous).toBeUndefined();
    });
  });

  describe('StatusCodeMapper extended', () => {
    it('should add and remove custom mappings', () => {
      class CustomError extends Error {}
      const mapper = new StatusCodeMapper();

      mapper.addMapping(CustomError, 418);
      expect(mapper.getStatusCode(new CustomError('test'))).toBe(418);

      mapper.removeMapping(CustomError);
      expect(mapper.getStatusCode(new CustomError('test'))).toBe(500);
    });

    it('should handle case-insensitive HTTP methods', () => {
      const mapper = new StatusCodeMapper();

      expect(mapper.getSuccessStatusCode('get', true)).toBe(200);
      expect(mapper.getSuccessStatusCode('POST', true)).toBe(201);
      expect(mapper.getSuccessStatusCode('delete', false)).toBe(204);
    });

    it('should return 200 for unknown methods', () => {
      const mapper = new StatusCodeMapper();
      expect(mapper.getSuccessStatusCode('CUSTOM', true)).toBe(200);
    });
  });
});
