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

## Lessons Learned

1. **ProtectedRoute Pattern**: Avoid nesting `<Routes>` inside `<ProtectedRoute>` as it causes routing bugs in React Router v6. Use the `<Outlet />` pattern instead:
   ```jsx
   // AppLayout renders header + <Outlet />
   const AppLayout = () => (
     <div>
       <header>...</header>
       <main><Outlet /></main>
     </div>
   );

   // Route config — children render inside the Outlet
   <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
     <Route path="/people" element={<PeoplePage />} />
     <Route path="/orders" element={<OrdersPage />} />
   </Route>
   ```