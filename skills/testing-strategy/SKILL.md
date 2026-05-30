---
name: testing-strategy
description: Testing requirements.
---

# Testing Strategy

Every business rule must be testable.

## Backend

Use:

- Vitest or Jest

Required coverage:

- Services
- Financial calculations
- Validation rules

Priority scenarios:

- partial payment
- full payment
- overpayment rejection
- status transitions
- transactional consistency

## Frontend

Use:

- React Testing Library

Test:

- forms
- authentication flow
- protected routes
- financial validations

## Rule

Do not create untestable business logic.