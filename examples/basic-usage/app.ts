import express from 'express';
import {
  responseWrapper,
  errorCatcher,
  asyncHandler,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  type FormattedResponse,
  type FormattedRequest,
} from 'apienvelope';

const app = express();
app.use(express.json());

app.use(responseWrapper({
  environment: 'development',
  includeStackTraces: true,
  generateRequestId: true,
}));

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
];

app.get('/api/users', (req, res: FormattedResponse) => {
  res.respond(users);
});

app.get('/api/users/:id', (req, res: FormattedResponse) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    throw new NotFoundError(`User with ID ${req.params.id} not found`);
  }
  res.respond(user);
});

app.post('/api/users', (req, res: FormattedResponse) => {
  const { name, email } = req.body;
  const errors: Record<string, string[]> = {};

  if (!name || name.length < 2) {
    errors.name = ['Name must be at least 2 characters'];
  }
  if (!email || !email.includes('@')) {
    errors.email = ['Valid email is required'];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  const newUser = { id: users.length + 1, name, email };
  users.push(newUser);
  res.respond(newUser, undefined, 201);
});

app.get('/api/posts', (req, res: FormattedResponse) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const allPosts = Array.from({ length: 95 }, (_, i) => ({
    id: i + 1,
    title: `Post ${i + 1}`,
    content: `Content for post ${i + 1}`,
  }));

  const start = (page - 1) * limit;
  const paginatedPosts = allPosts.slice(start, start + limit);

  res.respondPaginated(paginatedPosts, { page, limit, total: allPosts.length });
});

app.get('/api/async-data', asyncHandler(async (req, res: FormattedResponse) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  res.respond({ message: 'Async data loaded', timestamp: new Date().toISOString() });
}));

app.get('/api/protected', (req: FormattedRequest, res: FormattedResponse) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Valid authorization token required');
  }
  res.respond({ message: 'Access granted', requestId: req.requestId });
});

app.use(errorCatcher({ environment: 'development', logErrors: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
