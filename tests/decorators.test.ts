import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  ResponseFormatter,
  createResponseDecorator,
  HandleErrors,
  ApiRoute,
  Validate,
  Paginate,
  CursorPaginate,
  NotFoundError,
  responseWrapper,
  errorCatcher,
} from '../src';

describe('Decorators', () => {
  describe('createResponseDecorator', () => {
    it('should create a decorator that formats responses', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const ResponseDecorator = createResponseDecorator(formatter);

      class TestController {
        @ResponseDecorator()
        async getUser(req: express.Request, res: express.Response) {
          return { id: 1, name: 'Test' };
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.get('/user', (req, res, next) => controller.getUser(req, res).catch(next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/user');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ id: 1, name: 'Test' });
    });

    it('should use custom status code', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const ResponseDecorator = createResponseDecorator(formatter);

      class TestController {
        @ResponseDecorator({ statusCode: 201 })
        async createUser(req: express.Request, res: express.Response) {
          return { id: 1 };
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.post('/user', (req, res, next) => controller.createUser(req, res).catch(next));

      const response = await request(app).post('/user');
      expect(response.status).toBe(201);
    });

    it('should pass raw response when raw option is set', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const ResponseDecorator = createResponseDecorator(formatter);

      class TestController {
        @ResponseDecorator({ raw: true })
        async getRaw(req: express.Request, res: express.Response) {
          return { raw: true };
        }
      }

      const app = express();
      const controller = new TestController();
      app.get('/raw', (req, res, next) => controller.getRaw(req, res).catch(next));

      const response = await request(app).get('/raw');
      expect(response.body).toEqual({ raw: true });
      expect(response.body.success).toBeUndefined();
    });

    it('should pass errors to next when provided', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });
      const ResponseDecorator = createResponseDecorator(formatter);

      class TestController {
        @ResponseDecorator()
        async failingMethod(req: express.Request, res: express.Response, next: express.NextFunction) {
          throw new NotFoundError('Not found');
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.get('/fail', (req, res, next) => controller.failingMethod(req, res, next).catch(next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/fail');
      expect(response.status).toBe(404);
    });
  });

  describe('HandleErrors', () => {
    it('should catch errors and pass to next', async () => {
      class TestController {
        @HandleErrors()
        async failingMethod(req: express.Request, res: express.Response, next: express.NextFunction) {
          throw new NotFoundError('Resource not found');
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.get('/error', (req, res, next) => controller.failingMethod(req, res, next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/error');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('ApiRoute', () => {
    it('should format response and handle errors', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @ApiRoute(formatter)
        async getItem(req: express.Request, res: express.Response, next: express.NextFunction) {
          return { item: 'test' };
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.get('/item', (req, res, next) => controller.getItem(req, res, next));

      const response = await request(app).get('/item');
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ item: 'test' });
    });

    it('should handle errors in ApiRoute', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @ApiRoute(formatter)
        async failingItem(req: express.Request, res: express.Response, next: express.NextFunction) {
          throw new NotFoundError('Item not found');
        }
      }

      const app = express();
      const controller = new TestController();
      app.get('/fail', (req, res, next) => controller.failingItem(req, res, next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/fail');
      expect(response.status).toBe(404);
    });

    it('should support raw option in ApiRoute', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @ApiRoute(formatter, { raw: true })
        async getRawItem(req: express.Request, res: express.Response, next: express.NextFunction) {
          return { rawData: true };
        }
      }

      const app = express();
      const controller = new TestController();
      app.get('/raw', (req, res, next) => controller.getRawItem(req, res, next));

      const response = await request(app).get('/raw');
      expect(response.body).toEqual({ rawData: true });
    });
  });

  describe('Validate', () => {
    it('should pass validation and continue', async () => {
      const validator = (data: unknown) => ({ valid: true });

      class TestController {
        @Validate(validator, 'body')
        async createItem(req: express.Request, res: express.Response, next: express.NextFunction) {
          res.json({ created: true });
        }
      }

      const app = express();
      app.use(express.json());
      const controller = new TestController();
      app.post('/item', (req, res, next) => controller.createItem(req, res, next));

      const response = await request(app)
        .post('/item')
        .send({ name: 'test' });
      expect(response.body).toEqual({ created: true });
    });

    it('should fail validation and return error', async () => {
      const validator = (data: unknown) => ({
        valid: false,
        errors: { name: ['Name is required'] },
      });

      class TestController {
        @Validate(validator, 'body')
        async createItem(req: express.Request, res: express.Response, next: express.NextFunction) {
          res.json({ created: true });
        }
      }

      const app = express();
      app.use(express.json());
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.post('/item', (req, res, next) => controller.createItem(req, res, next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app)
        .post('/item')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Paginate', () => {
    it('should handle paginated responses', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @Paginate(formatter, { defaultLimit: 10 })
        async getItems(req: express.Request, res: express.Response, next: express.NextFunction) {
          return {
            data: [{ id: 1 }, { id: 2 }],
            total: 100,
          };
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.get('/items', (req, res, next) => controller.getItems(req, res, next));

      const response = await request(app).get('/items?page=1&limit=10');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(100);
    });

    it('should handle errors in paginated route', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @Paginate(formatter)
        async failingItems(req: express.Request, res: express.Response, next: express.NextFunction) {
          throw new NotFoundError('Items not found');
        }
      }

      const app = express();
      const controller = new TestController();
      app.get('/items', (req, res, next) => controller.failingItems(req, res, next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/items');
      expect(response.status).toBe(404);
    });
  });

  describe('CursorPaginate', () => {
    it('should handle cursor paginated responses', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @CursorPaginate(formatter, { defaultLimit: 10 })
        async getItems(req: express.Request, res: express.Response, next: express.NextFunction) {
          return {
            data: [{ id: 1 }, { id: 2 }],
            nextCursor: 'cursor_abc',
            hasMore: true,
          };
        }
      }

      const app = express();
      app.use(responseWrapper({ environment: 'test' }));
      const controller = new TestController();
      app.get('/items', (req, res, next) => controller.getItems(req, res, next));

      const response = await request(app).get('/items?limit=10');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.nextCursor).toBe('cursor_abc');
    });

    it('should handle errors in cursor paginated route', async () => {
      const formatter = new ResponseFormatter({ environment: 'test' });

      class TestController {
        @CursorPaginate(formatter)
        async failingItems(req: express.Request, res: express.Response, next: express.NextFunction) {
          throw new NotFoundError('Items not found');
        }
      }

      const app = express();
      const controller = new TestController();
      app.get('/items', (req, res, next) => controller.failingItems(req, res, next));
      app.use(errorCatcher({ logErrors: false }));

      const response = await request(app).get('/items');
      expect(response.status).toBe(404);
    });
  });
});
