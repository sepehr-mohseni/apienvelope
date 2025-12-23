import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  responseWrapper,
  createResponseWrapper,
  errorCatcher,
  createErrorCatcher,
  catchErrors,
  ResponseFormatter,
  NotFoundError,
  ValidationError,
  type FormattedResponse,
  type FormattedRequest,
} from '../src';

describe('Extended Middleware Tests', () => {
  describe('responseWrapper extended', () => {
    it('should handle cursor pagination', async () => {
      const app = express();
      app.use(responseWrapper({ environment: 'test' }));

      app.get('/items', (req, res: FormattedResponse) => {
        res.respondCursorPaginated(
          [{ id: 1 }, { id: 2 }],
          {
            limit: 10,
            cursor: 'abc',
            nextCursor: 'def',
            hasMore: true,
          }
        );
      });

      const response = await request(app).get('/items');
      expect(response.status).toBe(200);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.nextCursor).toBe('def');
    });

    it('should skip based on custom condition', async () => {
      const app = express();
      app.use(responseWrapper({
        environment: 'test',
        skipCondition: (req) => req.path === '/skip',
      }));

      app.get('/skip', (req, res) => {
        res.json({ skipped: true });
      });

      const response = await request(app).get('/skip');
      expect(response.body).toEqual({ skipped: true });
      expect(response.body.success).toBeUndefined();
    });

    it('should handle correlation ID', async () => {
      const app = express();
      app.use(responseWrapper({ environment: 'test' }));

      app.get('/test', (req: FormattedRequest, res: FormattedResponse) => {
        res.respond({ correlationId: req.correlationId });
      });

      const response = await request(app)
        .get('/test')
        .set('x-correlation-id', 'corr-123');

      expect(response.headers['x-correlation-id']).toBe('corr-123');
      expect(response.body.meta?.correlationId).toBe('corr-123');
    });

    it('should provide formatter on response', async () => {
      const app = express();
      app.use(responseWrapper({ environment: 'test' }));

      app.get('/test', (req, res: FormattedResponse) => {
        expect(res.formatter).toBeDefined();
        expect(res.formatter).toBeInstanceOf(ResponseFormatter);
        res.respond({ ok: true });
      });

      await request(app).get('/test');
    });
  });

  describe('createResponseWrapper', () => {
    it('should work with custom formatter', async () => {
      const formatter = new ResponseFormatter({
        environment: 'test',
        includeTimestamp: false,
      });

      const app = express();
      app.use(createResponseWrapper(formatter));

      app.get('/test', (req, res: FormattedResponse) => {
        res.respond({ data: 'test' });
      });

      const response = await request(app).get('/test');
      expect(response.body.success).toBe(true);
      expect(response.body.timestamp).toBe('');
    });

    it('should skip paths with custom formatter', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      const app = express();
      app.use(createResponseWrapper(formatter, { skipPaths: ['/health'] }));

      app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
      });

      const response = await request(app).get('/health');
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('errorCatcher extended', () => {
    it('should use custom handler', async () => {
      const customHandler = vi.fn((error, req, res) => {
        res.status(418).json({ custom: true });
        return true;
      });

      const app = express();
      app.get('/error', () => {
        throw new Error('Test');
      });
      app.use(errorCatcher({
        logErrors: false,
        customHandler,
      }));

      const response = await request(app).get('/error');
      expect(customHandler).toHaveBeenCalled();
      expect(response.status).toBe(418);
    });

    it('should transform errors', async () => {
      const app = express();
      app.get('/error', () => {
        throw new Error('Original');
      });
      app.use(errorCatcher({
        logErrors: false,
        transformError: () => new ValidationError('Transformed'),
      }));

      const response = await request(app).get('/error');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should use custom error logger', async () => {
      const customLogger = vi.fn();

      const app = express();
      app.get('/error', () => {
        throw new Error('Test');
      });
      app.use(errorCatcher({
        logErrors: true,
        errorLogger: customLogger,
      }));

      await request(app).get('/error');
      expect(customLogger).toHaveBeenCalled();
    });

    it('should extract request ID from FormattedRequest', async () => {
      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app)
        .get('/error')
        .set('x-request-id', 'req-123');

      expect(response.body.meta?.requestId).toBe('req-123');
    });
  });

  describe('createErrorCatcher', () => {
    it('should work with custom formatter', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      const app = express();
      app.get('/error', () => {
        throw new NotFoundError('Not found');
      });
      app.use(createErrorCatcher(formatter, { logErrors: false }));

      const response = await request(app).get('/error');
      expect(response.status).toBe(404);
    });

    it('should use custom handler with formatter', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const customHandler = vi.fn((error, req, res) => {
        res.status(500).json({ handled: true });
        return true;
      });

      const app = express();
      app.get('/error', () => {
        throw new Error('Test');
      });
      app.use(createErrorCatcher(formatter, {
        logErrors: false,
        customHandler,
      }));

      const response = await request(app).get('/error');
      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('catchErrors', () => {
    it('should catch async errors', async () => {
      const app = express();
      app.use(responseWrapper({ environment: 'test' }));

      app.get('/async', catchErrors(async (req, res: FormattedResponse) => {
        throw new NotFoundError('Async error');
      }));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/async');
      expect(response.status).toBe(404);
    });

    it('should pass through successful responses', async () => {
      const app = express();
      app.use(responseWrapper({ environment: 'test' }));

      app.get('/success', catchErrors(async (req, res: FormattedResponse) => {
        res.respond({ success: true });
      }));

      const response = await request(app).get('/success');
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ success: true });
    });
  });
});
