# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-23

### Added
- Initial release
- Standardized response envelope for success and error responses
- Automatic HTTP status code mapping based on error types
- Predefined error classes: ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, InternalServerError, BadRequestError, RateLimitError, ServiceUnavailableError, UnprocessableEntityError
- Offset-based and cursor-based pagination support
- HATEOAS-style pagination links
- Full TypeScript support with generics and discriminated unions
- Express middleware for automatic response wrapping
- Global error handling middleware
- Async handler wrapper for cleaner route definitions
- Request ID and correlation ID tracking
- Sensitive data masking in error responses
- Pre/post response hooks for customization
- Custom error mappers and serializers
- Type guards for response type narrowing
