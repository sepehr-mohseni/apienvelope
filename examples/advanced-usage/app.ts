import express from 'express';
import {
  ResponseFormatter,
  createResponseWrapper,
  createErrorCatcher,
  PaginationHelper,
  ApiError,
  asyncHandler,
  type FormattedResponse,
  type FormattedRequest,
  type PreResponseHook,
  type PostResponseHook,
} from 'apienvelope';

const app = express();
app.use(express.json());

class BusinessLogicError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'BUSINESS_LOGIC_ERROR', statusCode: 422, details });
  }
}

class RateLimitExceededError extends ApiError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: { retryAfter },
    });
  }
}

const addVersionHook: PreResponseHook = (data, meta) => ({
  data,
  meta: { ...meta, apiVersion: '2.0.0' },
});

const addProcessingTimeHook: PostResponseHook = (response) => ({
  ...response,
  meta: { ...response.meta, processedAt: new Date().toISOString() },
});

const formatter = new ResponseFormatter({
  environment: 'development',
  includeStackTraces: true,
  maskSensitiveData: true,
  sensitiveFields: ['password', 'token', 'secret', 'ssn', 'creditCard'],
  pagination: { defaultLimit: 20, maxLimit: 100, includeLinks: true },
  customErrorMappers: new Map([
    [BusinessLogicError, 422],
    [RateLimitExceededError, 429],
  ]),
  preResponseHooks: [addVersionHook],
  postResponseHooks: [addProcessingTimeHook],
});

const paginationHelper = new PaginationHelper({
  defaultLimit: 20,
  maxLimit: 100,
  includeLinks: true,
});

app.use(createResponseWrapper(formatter));

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  createdAt: Date;
}

const products: Product[] = Array.from({ length: 150 }, (_, i) => ({
  id: `prod_${(i + 1).toString().padStart(4, '0')}`,
  name: `Product ${i + 1}`,
  price: Math.round(Math.random() * 10000) / 100,
  category: ['Electronics', 'Clothing', 'Books', 'Home'][i % 4],
  createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
}));

app.get('/api/products', (req, res: FormattedResponse) => {
  const { page, limit } = paginationHelper.extractFromRequest(req);
  const offset = paginationHelper.calculateOffset(page, limit);
  const paginatedProducts = products.slice(offset, offset + limit);
  res.respondPaginated(paginatedProducts, { page, limit, total: products.length });
});

app.get('/api/products/cursor', (req, res: FormattedResponse) => {
  const { cursor, limit } = paginationHelper.extractCursorFromRequest(req);

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = products.findIndex(p => p.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginatedProducts = products.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < products.length;
  const nextCursor = hasMore ? paginatedProducts[paginatedProducts.length - 1]?.id : undefined;

  res.respondCursorPaginated(paginatedProducts, { limit, cursor, nextCursor, hasMore });
});

app.post('/api/orders', asyncHandler(async (req, res: FormattedResponse) => {
  const { productId, quantity } = req.body;

  const product = products.find(p => p.id === productId);
  if (!product) {
    throw new BusinessLogicError('Cannot create order', { reason: 'Product not found', productId });
  }

  if (quantity > 100) {
    throw new BusinessLogicError('Order quantity exceeds maximum', {
      maxQuantity: 100,
      requestedQuantity: quantity,
    });
  }

  const order = {
    id: `order_${Date.now()}`,
    productId,
    quantity,
    total: product.price * quantity,
    status: 'pending',
  };

  res.respond(order, undefined, 201);
}));

let requestCount = 0;
app.get('/api/rate-limited', (req, res: FormattedResponse) => {
  requestCount++;
  if (requestCount > 5) {
    requestCount = 0;
    throw new RateLimitExceededError(60);
  }
  res.respond({ message: 'Request successful', remainingRequests: 5 - requestCount });
});

app.get('/api/context-error', (req: FormattedRequest, res: FormattedResponse) => {
  throw new ApiError('Operation failed', {
    code: 'OPERATION_FAILED',
    statusCode: 500,
    context: {
      requestId: req.requestId,
      correlationId: req.correlationId,
      userId: 'user_123',
      operation: 'data_sync',
    },
  });
});

app.use(createErrorCatcher(formatter, {
  logErrors: true,
  errorLogger: (error, req) => {
    console.error({
      timestamp: new Date().toISOString(),
      error: error.message,
      path: req.path,
      method: req.method,
      requestId: (req as FormattedRequest).requestId,
    });
  },
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
