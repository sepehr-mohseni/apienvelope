import { describe, it, expect } from 'vitest';
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  BadRequestError,
  RateLimitError,
  ServiceUnavailableError,
  UnprocessableEntityError,
} from '../src';

describe('ApiError', () => {
  it('should create error with default values', () => {
    const error = new ApiError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.timestamp).toBeDefined();
  });

  it('should create error with custom options', () => {
    const error = new ApiError('Custom error', {
      code: 'CUSTOM_CODE',
      statusCode: 418,
      details: { foo: 'bar' },
      isOperational: false,
    });

    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.statusCode).toBe(418);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.isOperational).toBe(false);
  });

  it('should serialize correctly', () => {
    const error = new ApiError('Test', {
      code: 'TEST',
      statusCode: 400,
      details: { key: 'value' },
    });

    const serialized = error.serialize();

    expect(serialized.code).toBe('TEST');
    expect(serialized.message).toBe('Test');
    expect(serialized.statusCode).toBe(400);
    expect(serialized.details).toEqual({ key: 'value' });
    expect(serialized.stack).toBeUndefined();
  });

  it('should include stack when requested', () => {
    const error = new ApiError('Test', { code: 'TEST' });
    const serialized = error.serialize(true);

    expect(serialized.stack).toBeDefined();
  });

  it('should handle error chain', () => {
    const cause = new Error('Root cause');
    const error = new ApiError('Wrapper', { code: 'WRAP', cause });

    const chain = error.getErrorChain();

    expect(chain.length).toBe(2);
    expect(chain[0].message).toBe('Wrapper');
    expect(chain[1].message).toBe('Root cause');
  });

  it('should add context with withContext', () => {
    const error = new ApiError('Test', { code: 'TEST' });
    const withContext = error.withContext({ requestId: 'req-123' });

    expect(withContext.context?.requestId).toBe('req-123');
  });

  it('should convert to JSON', () => {
    const error = new ApiError('Test', {
      code: 'TEST',
      statusCode: 400,
    });

    const json = error.toJSON();

    expect(json.name).toBe('ApiError');
    expect(json.message).toBe('Test');
    expect(json.code).toBe('TEST');
    expect(json.statusCode).toBe(400);
  });
});

describe('Predefined Errors', () => {
  it('ValidationError should have correct defaults', () => {
    const error = new ValidationError('Invalid input', {
      email: ['Invalid format'],
    });

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.fields).toEqual({ email: ['Invalid format'] });
  });

  it('NotFoundError should have correct defaults', () => {
    const error = new NotFoundError('User not found');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('UnauthorizedError should have correct defaults', () => {
    const error = new UnauthorizedError();

    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('ForbiddenError should have correct defaults', () => {
    const error = new ForbiddenError();

    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
  });

  it('ConflictError should have correct defaults', () => {
    const error = new ConflictError('Duplicate entry');

    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
  });

  it('InternalServerError should have correct defaults', () => {
    const error = new InternalServerError();

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
  });

  it('BadRequestError should have correct defaults', () => {
    const error = new BadRequestError('Malformed request');

    expect(error.code).toBe('BAD_REQUEST');
    expect(error.statusCode).toBe(400);
  });

  it('RateLimitError should have correct defaults', () => {
    const error = new RateLimitError('Too many requests', 60);

    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
  });

  it('ServiceUnavailableError should have correct defaults', () => {
    const error = new ServiceUnavailableError();

    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.statusCode).toBe(503);
  });

  it('UnprocessableEntityError should have correct defaults', () => {
    const error = new UnprocessableEntityError();

    expect(error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(error.statusCode).toBe(422);
  });
});
