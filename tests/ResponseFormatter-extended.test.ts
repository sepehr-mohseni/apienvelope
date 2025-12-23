import { describe, it, expect } from 'vitest';
import {
  ResponseFormatter,
  createResponseFormatter,
  ApiError,
  ValidationError,
  responseFormatter,
} from '../src';

describe('ResponseFormatter Extended', () => {
  describe('formatCursorPaginated', () => {
    it('should format cursor paginated response', () => {
      const formatter = createResponseFormatter({ environment: 'test' });
      const response = formatter.formatCursorPaginated(
        [{ id: 1 }, { id: 2 }],
        {
          limit: 10,
          cursor: 'abc',
          nextCursor: 'def',
          previousCursor: 'xyz',
          hasMore: true,
        }
      );

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.cursor).toBe('abc');
      expect(response.pagination.nextCursor).toBe('def');
      expect(response.pagination.previousCursor).toBe('xyz');
      expect(response.pagination.hasMore).toBe(true);
    });

    it('should include links when configured', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        pagination: {
          defaultLimit: 10,
          maxLimit: 100,
          includeLinks: true,
          baseUrl: 'http://api.example.com/items',
        },
      });

      const response = formatter.formatCursorPaginated(
        [{ id: 1 }],
        {
          limit: 10,
          cursor: 'abc',
          nextCursor: 'def',
          hasMore: true,
        },
        undefined,
        'http://api.example.com/items'
      );

      expect(response.pagination.links).toBeDefined();
      expect(response.pagination.links?.next).toContain('cursor=def');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const formatter = createResponseFormatter({ environment: 'development' });
      expect(formatter.getConfig().environment).toBe('development');

      formatter.updateConfig({ environment: 'production' });
      expect(formatter.getConfig().environment).toBe('production');
    });

    it('should update custom error mappers', () => {
      class CustomError extends Error {}
      const formatter = createResponseFormatter({ environment: 'test' });

      formatter.updateConfig({
        customErrorMappers: new Map([[CustomError, 422]]),
      });

      const error = new CustomError('Test');
      expect(formatter.getErrorStatusCode(error)).toBe(422);
    });
  });

  describe('getRequestId', () => {
    it('should return existing ID if provided', () => {
      const formatter = createResponseFormatter({ environment: 'test' });
      const id = formatter.getRequestId('existing-id');
      expect(id).toBe('existing-id');
    });

    it('should generate new ID if not provided and generateRequestId is true', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        generateRequestId: true,
      });
      const id = formatter.getRequestId();
      expect(id).toBeTruthy();
      expect(id.length).toBeGreaterThan(0);
    });

    it('should return empty string if not provided and generateRequestId is false', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        generateRequestId: false,
      });
      const id = formatter.getRequestId();
      expect(id).toBe('');
    });
  });

  describe('passthrough mode', () => {
    it('should use custom formatter in passthrough mode for success', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        passthroughMode: true,
        customFormatter: (response) => ({
          ...response,
          custom: true,
        }),
      });

      const response = formatter.formatSuccess({ id: 1 });
      expect((response as any).custom).toBe(true);
    });

    it('should use custom formatter in passthrough mode for error', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        passthroughMode: true,
        customFormatter: (response) => ({
          ...response,
          customError: true,
        }),
      });

      const response = formatter.formatError(new Error('Test'));
      expect((response as any).customError).toBe(true);
    });
  });

  describe('timestamp handling', () => {
    it('should include timestamp when configured', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        includeTimestamp: true,
      });

      const response = formatter.formatSuccess({ id: 1 });
      expect(response.timestamp).toBeTruthy();
      expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });

    it('should exclude timestamp when configured', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        includeTimestamp: false,
      });

      const response = formatter.formatSuccess({ id: 1 });
      expect(response.timestamp).toBe('');
    });
  });

  describe('responseFormatter convenience function', () => {
    it('should return wrapper and errorHandler middleware', () => {
      const { wrapper, errorHandler } = responseFormatter({ environment: 'test' });

      expect(wrapper).toBeDefined();
      expect(typeof wrapper).toBe('function');
      expect(errorHandler).toBeDefined();
      expect(typeof errorHandler).toBe('function');
    });
  });

  describe('error formatting with details', () => {
    it('should include error details', () => {
      const formatter = createResponseFormatter({ environment: 'test' });
      const error = new ApiError('Test error', {
        code: 'TEST',
        statusCode: 400,
        details: { field: 'value' },
      });

      const response = formatter.formatError(error);
      expect(response.error.details).toEqual({ field: 'value' });
    });

    it('should mask sensitive fields in details', () => {
      const formatter = createResponseFormatter({
        environment: 'test',
        maskSensitiveData: true,
        sensitiveFields: ['password', 'secret'],
      });

      const error = new ApiError('Test error', {
        code: 'TEST',
        statusCode: 400,
        details: {
          password: 'secret123',
          username: 'john',
        },
      });

      const response = formatter.formatError(error);
      expect(response.error.details?.password).toBe('[REDACTED]');
      expect(response.error.details?.username).toBe('john');
    });
  });

  describe('pagination with meta', () => {
    it('should include meta in paginated response', () => {
      const formatter = createResponseFormatter({ environment: 'test' });
      const response = formatter.formatPaginated(
        [{ id: 1 }],
        { page: 1, limit: 10, total: 100 },
        { requestId: 'req-123' }
      );

      expect(response.meta?.requestId).toBe('req-123');
    });

    it('should include meta in cursor paginated response', () => {
      const formatter = createResponseFormatter({ environment: 'test' });
      const response = formatter.formatCursorPaginated(
        [{ id: 1 }],
        { limit: 10, hasMore: false },
        { correlationId: 'corr-123' }
      );

      expect(response.meta?.correlationId).toBe('corr-123');
    });
  });
});
