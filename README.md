# apienvelope

[![npm version](https://badge.fury.io/js/apienvelope.svg)](https://www.npmjs.com/package/apienvelope)
[![Test Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)](https://github.com/sepehr-mohseni/apienvelope)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Standardized API response formatting for Express.js applications. Enforces consistent response structures, handles errors gracefully, and provides built-in pagination support with full TypeScript coverage.

## Why apienvelope?

Building REST APIs often leads to inconsistent response formats across endpoints. This package solves that by providing:

- **Uniform response structure** across your entire API
- **Zero-config error handling** with proper HTTP status codes
- **Built-in request tracing** via request/correlation IDs
- **Type-safe responses** that work seamlessly with frontend clients

## Installation

```bash
npm install apienvelope
```

## Quick Start

```typescript
import express from 'express';
import { responseWrapper, errorCatcher, NotFoundError } from 'apienvelope';

const app = express();

app.use(responseWrapper({ environment: 'production' }));

app.get('/users/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.respond(user);
});

app.get('/posts', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const { data, total } = await db.posts.paginate(page, limit);
  res.respondPaginated(data, { page: Number(page), limit: Number(limit), total });
});

app.use(errorCatcher({ environment: 'production' }));

app.listen(3000);
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { "id": 1, "name": "John Doe", "email": "john@example.com" },
  "meta": { "requestId": "req_abc123" },
  "timestamp": "2024-12-23T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "email": ["Invalid email format"],
      "password": ["Must be at least 8 characters"]
    }
  },
  "meta": { "requestId": "req_abc123" },
  "timestamp": "2024-12-23T10:30:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [{ "id": 1, "title": "Post 1" }, { "id": 2, "title": "Post 2" }],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2024-12-23T10:30:00.000Z"
}
```

## Error Classes

| Class | Status | Code |
|-------|--------|------|
| `ValidationError` | 400 | VALIDATION_ERROR |
| `BadRequestError` | 400 | BAD_REQUEST |
| `UnauthorizedError` | 401 | UNAUTHORIZED |
| `ForbiddenError` | 403 | FORBIDDEN |
| `NotFoundError` | 404 | NOT_FOUND |
| `ConflictError` | 409 | CONFLICT |
| `UnprocessableEntityError` | 422 | UNPROCESSABLE_ENTITY |
| `RateLimitError` | 429 | RATE_LIMIT_EXCEEDED |
| `InternalServerError` | 500 | INTERNAL_ERROR |
| `ServiceUnavailableError` | 503 | SERVICE_UNAVAILABLE |

## Configuration

```typescript
app.use(responseWrapper({
  environment: 'production',
  includeStackTraces: false,
  
  requestIdHeader: 'x-request-id',
  correlationIdHeader: 'x-correlation-id',
  generateRequestId: true,
  
  maskSensitiveData: true,
  sensitiveFields: ['password', 'token', 'secret', 'apiKey'],
  
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    includeLinks: true,
  },
  
  customErrorMappers: new Map([
    [PaymentError, 402],
    [RateLimitError, 429],
  ]),
}));
```

## TypeScript Support

Full generic support for type-safe API responses:

```typescript
import { ApiResponse, isSuccessResponse } from 'apienvelope';

interface User {
  id: number;
  name: string;
}

async function getUser(id: number): Promise<User | null> {
  const response: ApiResponse<User> = await fetch(`/api/users/${id}`).then(r => r.json());
  
  if (isSuccessResponse(response)) {
    return response.data; // TypeScript infers User type
  }
  return null;
}
```

## Custom Errors

Extend `ApiError` for domain-specific errors:

```typescript
import { ApiError } from 'apienvelope';

class InsufficientFundsError extends ApiError {
  constructor(balance: number, required: number) {
    super('Insufficient funds for this transaction', {
      code: 'INSUFFICIENT_FUNDS',
      statusCode: 402,
      details: { currentBalance: balance, requiredAmount: required },
    });
  }
}
```

## Async Handler

Wrap async routes to automatically catch and forward errors:

```typescript
import { asyncHandler } from 'apienvelope';

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  res.respond(user);
}));
```

## Pagination Helper

Utility class for handling pagination logic:

```typescript
import { PaginationHelper } from 'apienvelope';

const paginator = new PaginationHelper({ defaultLimit: 20, maxLimit: 100 });

app.get('/items', async (req, res) => {
  const { page, limit } = paginator.extractFromRequest(req);
  const offset = paginator.calculateOffset(page, limit);
  
  const items = await db.items.find().skip(offset).limit(limit);
  const total = await db.items.count();
  
  res.respondPaginated(items, { page, limit, total });
});
```

## Cursor Pagination

Support for cursor-based pagination:

```typescript
app.get('/feed', async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const { items, nextCursor } = await db.feed.getCursor(cursor, limit);
  
  res.respondCursorPaginated(items, {
    limit: Number(limit),
    cursor: cursor as string,
    nextCursor,
    hasMore: !!nextCursor,
  });
});
```

## Response Hooks

Transform responses before they're sent:

```typescript
app.use(responseWrapper({
  preResponseHooks: [
    (data, meta) => ({
      data,
      meta: { ...meta, apiVersion: '2.0' },
    }),
  ],
  postResponseHooks: [
    (response) => ({
      ...response,
      meta: { ...response.meta, serverTime: Date.now() },
    }),
  ],
}));
```

## API Reference

### Middleware
- `responseWrapper(options)` - Adds response formatting methods to Express
- `errorCatcher(options)` - Global error handler middleware
- `asyncHandler(fn)` - Wraps async functions for error handling

### Response Methods
- `res.respond(data, meta?, statusCode?)` - Send formatted success response
- `res.respondPaginated(data, pagination, meta?)` - Send paginated response
- `res.respondCursorPaginated(data, pagination, meta?)` - Send cursor-paginated response
- `res.respondError(error, meta?)` - Send formatted error response

### Classes
- `ResponseFormatter` - Core formatting logic
- `PaginationHelper` - Pagination utilities
- `ApiError` - Base error class
- `StatusCodeMapper` - HTTP status code mapping

### Type Guards
- `isSuccessResponse(response)` - Check if response is successful
- `isErrorResponse(response)` - Check if response is an error
- `isPaginatedResponse(response)` - Check if response is paginated

## Requirements

- Node.js >= 16.0.0
- Express >= 4.0.0

## Author

**Sepehr Mohseni**

- [GitHub](https://github.com/sepehr-mohseni)
- [LinkedIn](https://www.linkedin.com/in/sepehr-mohseni/)
- [npm](https://www.npmjs.com/~sepehr-mohseni)

## License

MIT
