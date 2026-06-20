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

## Lessons Learned (Vitest & React Testing Library)

1. **vi.mock Hoisting Bug**: `vi.mock()` factory functions are hoisted to the top of the file. Use arrow function wrappers to avoid undefined variables:
   ```js
   const mockGet = vi.fn();
   const mockPost = vi.fn();
   vi.mock('../src/services/api', () => ({
     default: {
       get: (...args) => mockGet(...args),
       post: (...args) => mockPost(...args),
     },
   }));
   ```

2. **HTML5 `required` Attribute**: In jsdom, clicking a submit button on a form with empty required fields does not trigger `onSubmit`. Use `fireEvent.submit(form)` instead of `fireEvent.click(submitButton)`.

3. **Conditional Rendering in Dynamic Lists**: When testing removal buttons in lists where the button is hidden for the first item (e.g., `items.length <= 1`), add at least 2 items first so all show the removal button, then target a specific one.

## Rule

Do not create untestable business logic.