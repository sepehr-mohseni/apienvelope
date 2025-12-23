import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResponseFormatter,
  createResponseFormatter,
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../src';

describe('ResponseFormatter', () => {
  let formatter: ResponseFormatter;

  beforeEach(() => {
    formatter = createResponseFormatter({
      environment: 'test',
      includeTimestamp: true,
    });
  });

  describe('formatSuccess', () => {
    it('should format success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = formatter.formatSuccess(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    it('should include meta when provided', () => {
      const data = { id: 1 };
      const meta = { requestId: 'req-123' };
      const response = formatter.formatSuccess(data, meta);

      expect(response.meta).toEqual(meta);
    });

    it('should handle null data', () => {
      const response = formatter.formatSuccess(null);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const response = formatter.formatSuccess(data);

      expect(response.data).toEqual([1, 2, 3]);
    });
  });

  describe('formatError', () => {
    it('should format ApiError correctly', () => {
      const error = new ApiError('Test error', {
        code: 'TEST_ERROR',
        statusCode: 400,
      });
      const response = formatter.formatError(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TEST_ERROR');
      expect(response.error.message).toBe('Test error');
    });

    it('should format ValidationError with fields', () => {
      const error = new ValidationError('Validation failed', {
        email: ['Invalid email format'],
        password: ['Too short'],
      });
      const response = formatter.formatError(error);

      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.fields).toEqual({
        email: ['Invalid email format'],
        password: ['Too short'],
      });
    });

    it('should format standard Error', () => {
      const error = new Error('Standard error');
      const response = formatter.formatError(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('INTERNAL_ERROR');
      expect(response.error.message).toBe('Standard error');
    });

    it('should include stack trace in development', () => {
      const devFormatter = createResponseFormatter({
        environment: 'development',
        includeStackTraces: true,
      });
      const error = new ApiError('Test', { code: 'TEST' });
      const response = devFormatter.formatError(error);

      expect(response.error.stack).toBeDefined();
    });

    it('should exclude stack trace in production', () => {
      const prodFormatter = createResponseFormatter({
        environment: 'production',
        includeStackTraces: false,
      });
      const error = new ApiError('Test', { code: 'TEST' });
      const response = prodFormatter.formatError(error);

      expect(response.error.stack).toBeUndefined();
    });
  });

  describe('formatPaginated', () => {
    it('should format paginated response correctly', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = formatter.formatPaginated(data, {
        page: 1,
        limit: 10,
        total: 25,
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.total).toBe(25);
      expect(response.pagination.totalPages).toBe(3);
      expect(response.pagination.hasNextPage).toBe(true);
      expect(response.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle empty data', () => {
      const response = formatter.formatPaginated([], {
        page: 1,
        limit: 10,
        total: 0,
      });

      expect(response.data).toEqual([]);
      expect(response.pagination.total).toBe(0);
      expect(response.pagination.totalPages).toBe(1);
      expect(response.pagination.hasNextPage).toBe(false);
    });

    it('should handle last page', () => {
      const response = formatter.formatPaginated([{ id: 1 }], {
        page: 3,
        limit: 10,
        total: 25,
      });

      expect(response.pagination.hasNextPage).toBe(false);
      expect(response.pagination.hasPreviousPage).toBe(true);
    });
  });

  describe('getErrorStatusCode', () => {
    it('should return correct status for ValidationError', () => {
      const error = new ValidationError('Invalid');
      expect(formatter.getErrorStatusCode(error)).toBe(400);
    });

    it('should return correct status for NotFoundError', () => {
      const error = new NotFoundError('Not found');
      expect(formatter.getErrorStatusCode(error)).toBe(404);
    });

    it('should return correct status for UnauthorizedError', () => {
      const error = new UnauthorizedError('Unauthorized');
      expect(formatter.getErrorStatusCode(error)).toBe(401);
    });

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown');
      expect(formatter.getErrorStatusCode(error)).toBe(500);
    });
  });

  describe('custom error mappers', () => {
    it('should use custom error mapper', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customFormatter = createResponseFormatter({
        customErrorMappers: new Map([[CustomError, 422]]),
      });

      const error = new CustomError('Custom');
      expect(customFormatter.getErrorStatusCode(error)).toBe(422);
    });
  });

  describe('hooks', () => {
    it('should apply pre-response hooks', () => {
      const hookFormatter = createResponseFormatter({
        preResponseHooks: [
          (data, meta) => ({
            data: { ...data as object, modified: true },
            meta,
          }),
        ],
      });

      const response = hookFormatter.formatSuccess({ id: 1 });
      expect((response.data as { modified: boolean }).modified).toBe(true);
    });

    it('should apply post-response hooks', () => {
      const hookFormatter = createResponseFormatter({
        postResponseHooks: [
          (response) => ({
            ...response,
            meta: { ...response.meta, processed: true },
          }),
        ],
      });

      const response = hookFormatter.formatSuccess({ id: 1 });
      expect(response.meta?.processed).toBe(true);
    });
  });
});
