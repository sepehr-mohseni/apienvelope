import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  ResponseFormatter,
  ErrorHandler,
  createErrorHandler,
  errorHandlerMiddleware,
  ApiError,
  NotFoundError,
  ValidationError,
  InternalServerError,
  responseWrapper,
} from '../src';

describe('ErrorHandler', () => {
  describe('ErrorHandler class', () => {
    it('should handle ApiError correctly', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, { logErrors: false });

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      app.get('/error', () => {
        throw new NotFoundError('Resource not found');
      });
      app.use(handler.middleware());

      const response = await request(app).get('/error');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle standard Error', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, { logErrors: false });

      const app = express();
      app.get('/error', () => {
        throw new Error('Something went wrong');
      });
      app.use(handler.middleware());

      const response = await request(app).get('/error');
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should use custom error logger', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const customLogger = vi.fn();
      const handler = new ErrorHandler(formatter, {
        logErrors: true,
        errorLogger: customLogger,
      });

      const app = express();
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(handler.middleware());

      await request(app).get('/error');
      expect(customLogger).toHaveBeenCalled();
    });

    it('should transform error before formatting', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, {
        logErrors: false,
        transformError: (error) => new ValidationError('Transformed error'),
      });

      const app = express();
      app.get('/error', () => {
        throw new Error('Original error');
      });
      app.use(handler.middleware());

      const response = await request(app).get('/error');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should call handleNonOperational for non-operational errors', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handleNonOperational = vi.fn((error, req, res) => {
        res.status(500).json({ custom: 'handler' });
      });
      const handler = new ErrorHandler(formatter, {
        logErrors: false,
        handleNonOperational,
      });

      const app = express();
      app.get('/error', () => {
        throw new InternalServerError('Critical error');
      });
      app.use(handler.middleware());

      const response = await request(app).get('/error');
      expect(handleNonOperational).toHaveBeenCalled();
      expect(response.body).toEqual({ custom: 'handler' });
    });

    it('should extract request ID from headers', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, { logErrors: false });

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(handler.middleware());

      const response = await request(app)
        .get('/error')
        .set('x-request-id', 'test-request-id');

      expect(response.body.meta?.requestId).toBe('test-request-id');
    });

    it('should extract correlation ID from headers', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, { logErrors: false });

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(handler.middleware());

      const response = await request(app)
        .get('/error')
        .set('x-correlation-id', 'test-correlation-id');

      expect(response.body.meta?.correlationId).toBe('test-correlation-id');
    });
  });

  describe('createErrorHandler', () => {
    it('should create an ErrorHandler instance', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = createErrorHandler(formatter, { logErrors: false });

      const app = express();
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(handler.middleware());

      const response = await request(app).get('/error');
      expect(response.status).toBe(404);
    });
  });

  describe('errorHandlerMiddleware', () => {
    it('should create middleware directly', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const middleware = errorHandlerMiddleware(formatter, { logErrors: false });

      const app = express();
      app.get('/error', () => {
        throw new ValidationError('Invalid input');
      });
      app.use(middleware);

      const response = await request(app).get('/error');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('logging behavior', () => {
    it('should log errors when logErrors is true', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, { logErrors: true });

      const app = express();
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(handler.middleware());

      await request(app).get('/error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log non-operational errors as error level', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const formatter = new ResponseFormatter({ environment: 'test' });
      const handler = new ErrorHandler(formatter, { logErrors: true });

      const app = express();
      app.get('/error', () => {
        throw new Error('Unexpected error');
      });
      app.use(handler.middleware());

      await request(app).get('/error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
