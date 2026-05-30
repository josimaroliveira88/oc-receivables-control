---
name: frontend-react
description: React and UI conventions.
---

# React Standards

## Components

Use:

- Functional Components
- Hooks

## State

Local:
- useState

Complex:
- useReducer

Authentication:
- React Context

## Styling

Use Tailwind CSS exclusively.

## API Layer

Centralize Axios configuration.

Required interceptor:

Authorization: Bearer <token>

from localStorage.

## Localization

All UI text must be PT-BR.

## Currency

Render values using:

Intl.NumberFormat(
  'pt-BR',
  {
    style: 'currency',
    currency: 'BRL'
  }
)