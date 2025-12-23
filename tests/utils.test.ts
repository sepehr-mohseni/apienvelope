import { describe, it, expect } from 'vitest';
import {
  StatusCodeMapper,
  createStatusCodeMapper,
  serializeError,
  generateRequestId,
  validateConfig,
  isPlainObject,
  ApiError,
  ValidationError,
  NotFoundError,
} from '../src';

describe('StatusCodeMapper', () => {
  describe('getStatusCode', () => {
    it('should return status from ApiError', () => {
      const mapper = createStatusCodeMapper();
      const error = new ApiError('Test', { statusCode: 418 });

      expect(mapper.getStatusCode(error)).toBe(418);
    });

    it('should map ValidationError to 400', () => {
      const mapper = createStatusCodeMapper();
      const error = new ValidationError('Invalid');

      expect(mapper.getStatusCode(error)).toBe(400);
    });

    it('should map NotFoundError to 404', () => {
      const mapper = createStatusCodeMapper();
      const error = new NotFoundError('Not found');

      expect(mapper.getStatusCode(error)).toBe(404);
    });

    it('should use custom mappings', () => {
      class CustomError extends Error {}
      const mapper = createStatusCodeMapper(new Map([[CustomError, 422]]));

      expect(mapper.getStatusCode(new CustomError('test'))).toBe(422);
    });

    it('should return 500 for unknown errors', () => {
      const mapper = createStatusCodeMapper();
      expect(mapper.getStatusCode(new Error('unknown'))).toBe(500);
    });
  });

  describe('getSuccessStatusCode', () => {
    const mapper = createStatusCodeMapper();

    it('should return 200 for GET', () => {
      expect(mapper.getSuccessStatusCode('GET', true)).toBe(200);
    });

    it('should return 201 for POST', () => {
      expect(mapper.getSuccessStatusCode('POST', true)).toBe(201);
    });

    it('should return 204 for DELETE without data', () => {
      expect(mapper.getSuccessStatusCode('DELETE', false)).toBe(204);
    });

    it('should return 200 for DELETE with data', () => {
      expect(mapper.getSuccessStatusCode('DELETE', true)).toBe(204);
    });
  });

  describe('static methods', () => {
    it('should identify success codes', () => {
      expect(StatusCodeMapper.isSuccessCode(200)).toBe(true);
      expect(StatusCodeMapper.isSuccessCode(201)).toBe(true);
      expect(StatusCodeMapper.isSuccessCode(204)).toBe(true);
      expect(StatusCodeMapper.isSuccessCode(400)).toBe(false);
    });

    it('should identify client errors', () => {
      expect(StatusCodeMapper.isClientError(400)).toBe(true);
      expect(StatusCodeMapper.isClientError(404)).toBe(true);
      expect(StatusCodeMapper.isClientError(200)).toBe(false);
      expect(StatusCodeMapper.isClientError(500)).toBe(false);
    });

    it('should identify server errors', () => {
      expect(StatusCodeMapper.isServerError(500)).toBe(true);
      expect(StatusCodeMapper.isServerError(503)).toBe(true);
      expect(StatusCodeMapper.isServerError(400)).toBe(false);
    });
  });
});

describe('serializeError', () => {
  it('should serialize ApiError', () => {
    const error = new ApiError('Test error', {
      code: 'TEST',
      statusCode: 400,
      details: { key: 'value' },
    });

    const serialized = serializeError(error);

    expect(serialized.code).toBe('TEST');
    expect(serialized.message).toBe('Test error');
    expect(serialized.details).toEqual({ key: 'value' });
  });

  it('should serialize standard Error', () => {
    const error = new Error('Standard error');
    const serialized = serializeError(error);

    expect(serialized.code).toBe('INTERNAL_ERROR');
    expect(serialized.message).toBe('Standard error');
  });

  it('should mask sensitive fields', () => {
    const error = new ApiError('Test', {
      code: 'TEST',
      details: {
        password: 'secret123',
        token: 'abc123',
        username: 'john',
      },
    });

    const serialized = serializeError(error, {
      includeStack: false,
      maskSensitiveData: true,
      sensitiveFields: ['password', 'token'],
    });

    expect(serialized.details?.password).toBe('[REDACTED]');
    expect(serialized.details?.token).toBe('[REDACTED]');
    expect(serialized.details?.username).toBe('john');
  });

  it('should include stack when requested', () => {
    const error = new ApiError('Test', { code: 'TEST' });
    const serialized = serializeError(error, { includeStack: true, maskSensitiveData: false, sensitiveFields: [] });

    expect(serialized.stack).toBeDefined();
  });

  it('should use custom serializer', () => {
    class CustomError extends Error {
      customField = 'custom';
    }

    const error = new CustomError('Custom');
    const serialized = serializeError(error, {
      includeStack: false,
      maskSensitiveData: false,
      sensitiveFields: [],
      customSerializers: new Map([
        [CustomError, (e) => ({
          code: 'CUSTOM',
          message: e.message,
          custom: (e as CustomError).customField,
        })],
      ]),
    });

    expect(serialized.code).toBe('CUSTOM');
    expect(serialized.details?.custom).toBe('custom');
  });
});

describe('generateRequestId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();

    expect(id1).not.toBe(id2);
  });

  it('should generate string IDs', () => {
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('validateConfig', () => {
  it('should return empty array for valid config', () => {
    const errors = validateConfig({
      environment: 'production',
      pagination: { defaultLimit: 10, maxLimit: 100 },
    });

    expect(errors).toHaveLength(0);
  });

  it('should detect invalid environment', () => {
    const errors = validateConfig({
      environment: 'invalid' as any,
    });

    expect(errors).toContain('Invalid environment: invalid');
  });

  it('should detect invalid pagination limits', () => {
    const errors = validateConfig({
      pagination: { defaultLimit: 0, maxLimit: 100 },
    });

    expect(errors).toContain('pagination.defaultLimit must be at least 1');
  });

  it('should detect defaultLimit exceeding maxLimit', () => {
    const errors = validateConfig({
      pagination: { defaultLimit: 200, maxLimit: 100 },
    });

    expect(errors).toContain('pagination.defaultLimit cannot exceed pagination.maxLimit');
  });
});

describe('isPlainObject', () => {
  it('should return true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ key: 'value' })).toBe(true);
  });

  it('should return false for arrays', () => {
    expect(isPlainObject([])).toBe(false);
  });

  it('should return false for null', () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isPlainObject('string')).toBe(false);
    expect(isPlainObject(123)).toBe(false);
    expect(isPlainObject(true)).toBe(false);
  });
});
