---

name: security-baseline
description: Security requirements for authentication, APIs, and infrastructure.
--------------------------------------------------------------------------------

# Security Baseline

Apply these rules to all backend and frontend implementations.

## Authentication

Use JWT authentication.

Requirements:

* Stateless authentication.
* Access tokens only.
* Expiration: 24 hours.
* Store secret keys in environment variables.
* Never hardcode secrets.

## Password Storage

Use bcrypt.

Requirements:

* Minimum 12 salt rounds.
* Never store plain text passwords.
* Never log passwords.

## API Security

Protected endpoints must:

* Validate JWT before processing requests.
* Return HTTP 401 for missing or invalid tokens.
* Return HTTP 403 for forbidden operations.

## Input Validation

Validate all external input using Zod.

Required targets:

* req.body
* req.params
* req.query

Never trust client-side validation.

## Error Handling

Do not expose:

* stack traces
* database errors
* internal implementation details

Return user-safe error messages.

## HTTP Security

Enable:

* Helmet middleware
* CORS restrictions
* JSON payload limits

Avoid overly permissive configurations.

## Secrets Management

Store sensitive values only in environment variables.

Examples:

* DATABASE_URL
* JWT_SECRET
* ADMIN_PASSWORD

Never commit secrets to source control.

## Logging

Logs must not contain:

* passwords
* tokens
* database credentials

Prefer structured logging.

## Database Security

Use Prisma parameterized queries.

Avoid raw SQL unless absolutely necessary.

## Frontend Security

Never store passwords.

JWT storage:

* localStorage for MVP
* prepare architecture for future migration to secure cookies

Never expose internal backend errors to users.

All user-facing security messages must be in Portuguese (Brazil).
