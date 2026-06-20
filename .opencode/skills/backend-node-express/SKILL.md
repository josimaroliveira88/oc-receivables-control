---
name: backend-node-express
description: Express architecture standards.
---

# Backend Standards

## Modules

Use ES Modules.

Preferred:

import/export

Avoid:

require/module.exports

## Layering

Routes
→ Controllers
→ Services
→ Prisma

## Validation

Use Zod for:

- req.body
- req.query
- req.params

## Error Handling

Use:

- asyncHandler wrappers
- centralized error middleware

## Authentication

Use JWT Bearer authentication.