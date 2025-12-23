import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import {
  responseWrapper,
  errorCatcher,
  asyncHandler,
  NotFoundError,
  ValidationError,
  type FormattedResponse,
} from '../src';

describe('Middleware Integration', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(responseWrapper({ environment: 'test' }));
  });

  describe('responseWrapper', () => {
    it('should add respond method to response', async () => {
      app.get('/test', (req, res: FormattedResponse) => {
        res.respond({ message: 'Hello' });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ message: 'Hello' });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should add respondPaginated method', async () => {
      app.get('/items', (req, res: FormattedResponse) => {
        res.respondPaginated(
          [{ id: 1 }, { id: 2 }],
          { page: 1, limit: 10, total: 50 }
        );
      });

      const response = await request(app).get('/items');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.total).toBe(50);
      expect(response.body.pagination.totalPages).toBe(5);
    });

    it('should add respondError method', async () => {
      app.get('/error', (req, res: FormattedResponse) => {
        res.respondError(new NotFoundError('Item not found'));
      });

      const response = await request(app).get('/error');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should generate request ID', async () => {
      app.get('/test', (req, res: FormattedResponse) => {
        res.respond({ ok: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.meta?.requestId).toBeDefined();
    });

    it('should use provided request ID', async () => {
      app.get('/test', (req, res: FormattedResponse) => {
        res.respond({ ok: true });
      });

      const response = await request(app)
        .get('/test')
        .set('x-request-id', 'custom-id');

      expect(response.headers['x-request-id']).toBe('custom-id');
      expect(response.body.meta?.requestId).toBe('custom-id');
    });

    it('should skip paths when configured', async () => {
      const skipApp = express();
      skipApp.use(responseWrapper({ skipPaths: ['/health'] }));
      
      skipApp.get('/health', (req, res) => {
        res.json({ status: 'ok' });
      });

      const response = await request(skipApp).get('/health');

      expect(response.body).toEqual({ status: 'ok' });
      expect(response.body.success).toBeUndefined();
    });
  });

  describe('errorCatcher', () => {
    beforeEach(() => {
      app.use(errorCatcher({ environment: 'test', logErrors: false }));
    });

    it('should catch and format errors', async () => {
      app.get('/throw', () => {
        throw new NotFoundError('Resource not found');
      });
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/throw');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle validation errors with fields', async () => {
      app.get('/validate', () => {
        throw new ValidationError('Validation failed', {
          email: ['Required'],
          name: ['Too short', 'Invalid characters'],
        });
      });
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/validate');

      expect(response.status).toBe(400);
      expect(response.body.error.fields).toEqual({
        email: ['Required'],
        name: ['Too short', 'Invalid characters'],
      });
    });

    it('should handle unknown errors as 500', async () => {
      app.get('/unknown', () => {
        throw new Error('Something went wrong');
      });
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/unknown');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('asyncHandler', () => {
    it('should catch async errors', async () => {
      app.get(
        '/async',
        asyncHandler(async () => {
          throw new NotFoundError('Async error');
        })
      );
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/async');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('Async error');
    });

    it('should pass through successful async responses', async () => {
      app.get(
        '/async-success',
        asyncHandler(async (req, res: FormattedResponse) => {
          await Promise.resolve();
          res.respond({ async: true });
        })
      );

      const response = await request(app).get('/async-success');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ async: true });
    });
  });
});
