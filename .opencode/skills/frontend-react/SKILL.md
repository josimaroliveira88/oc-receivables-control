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

2. **Page-as-orchestrator pattern**: each complex page lives in `src/pages/{Nome}/` with:
   - `index.jsx` (≈60–150 lines): pure orchestration — hook call + loading/error states + composition of subcomponents. No business logic and no direct `api.*` calls.
   - `use{Nome}.js`: owns every `useState`/`useRef`, every API call (`api.get`, `api.post`, …), and every mutation handler (`handleCreate`, `handleUpdate`, …). Returns a destructurable object of state + handlers.
   - `components/`: local subcomponents (table, modal, form, badge, etc.) that receive data and callbacks via props only.
   - `utils/{nome}Helpers.js`: pure helpers (formatters, validators, status maps, calculations) — anything that does not depend on React state.
   - The original `*Page.jsx` file becomes a one-line shim (`export { default } from './{Nome}/index.jsx';`) so existing imports (routes, tests) keep working without edits.
   See `frontend/docs/frontend-architecture-guide.md` for the progressive complexity policy, per-type conventions, and the page-refactoring playbook.