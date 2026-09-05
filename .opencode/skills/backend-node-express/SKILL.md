---
name: backend-node-express
description: Express architecture standards.
---

# Backend Standards

## Modules

Use ES Modules (the backend is `"type": "module"`):

import/export

## Design Principles

Apply SOLID pragmatically (see `AGENTS.md` — Design Principles). In the backend:

- **SRP** maps to the layering: routes map endpoints, controllers handle HTTP only, services hold business rules, `utils/` helpers derive pure values.
- **DIP** keeps services/helpers dependent on stable contracts (Prisma models, plain shapes, exported helpers), never on Express/HTTP details or a caller's internals.
- **OCP** extends behavior through new modules or options (filters, sorters, validators) rather than editing well-tested core functions.

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