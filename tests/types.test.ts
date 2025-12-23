import { describe, it, expect } from 'vitest';
import {
  isSuccessResponse,
  isErrorResponse,
  isPaginatedResponse,
  type SuccessResponse,
  type ErrorResponse,
  type PaginatedResponse,
  type ApiResponse,
} from '../src';

describe('Type Guards', () => {
  describe('isSuccessResponse', () => {
    it('should return true for success response', () => {
      const response: ApiResponse<{ id: number }> = {
        success: true,
        data: { id: 1 },
        timestamp: new Date().toISOString(),
      };

      expect(isSuccessResponse(response)).toBe(true);
    });

    it('should return false for error response', () => {
      const response: ApiResponse<{ id: number }> = {
        success: false,
        error: {
          code: 'ERROR',
          message: 'Error message',
        },
        timestamp: new Date().toISOString(),
      };

      expect(isSuccessResponse(response)).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for error response', () => {
      const response: ApiResponse<unknown> = {
        success: false,
        error: {
          code: 'ERROR',
          message: 'Error message',
        },
        timestamp: new Date().toISOString(),
      };

      expect(isErrorResponse(response)).toBe(true);
    });

    it('should return false for success response', () => {
      const response: ApiResponse<unknown> = {
        success: true,
        data: { id: 1 },
        timestamp: new Date().toISOString(),
      };

      expect(isErrorResponse(response)).toBe(false);
    });
  });

  describe('isPaginatedResponse', () => {
    it('should return true for paginated response', () => {
      const response: PaginatedResponse<{ id: number }> = {
        success: true,
        data: [{ id: 1 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
          totalPages: 10,
          hasNextPage: true,
          hasPreviousPage: false,
        },
        timestamp: new Date().toISOString(),
      };

      expect(isPaginatedResponse(response)).toBe(true);
    });

    it('should return false for error response', () => {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'ERROR',
          message: 'Error',
        },
        timestamp: new Date().toISOString(),
      };

      expect(isPaginatedResponse(response)).toBe(false);
    });
  });
});

describe('Type Inference', () => {
  it('should narrow types correctly with type guards', () => {
    const response: ApiResponse<{ name: string }> = {
      success: true,
      data: { name: 'Test' },
      timestamp: new Date().toISOString(),
    };

    if (isSuccessResponse(response)) {
      // TypeScript should know response.data is { name: string }
      expect(response.data.name).toBe('Test');
    }
  });

  it('should narrow error types correctly', () => {
    const response: ApiResponse<unknown> = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
      timestamp: new Date().toISOString(),
    };

    if (isErrorResponse(response)) {
      // TypeScript should know response.error exists
      expect(response.error.code).toBe('NOT_FOUND');
    }
  });
});
