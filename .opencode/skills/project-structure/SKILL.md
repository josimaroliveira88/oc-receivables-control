---
name: project-structure
description: Project organization and folder conventions.
---

# Project Structure

Maintain a clear separation of concerns.

## Backend Structure

backend/

src/
├── controllers/
├── services/
├── routes/
├── middlewares/
├── validations/
├── utils/
├── config/
├── prisma/
└── server.js

## Frontend Structure

frontend/

src/
├── components/                  # Shared, reusable UI (ActionMenu, ConfirmDialog, Toast, layout, etc.)
├── context/                     # Global React state (AuthContext, ThemeContext)
├── pages/                       # Route-level screens
│   ├── LoginPage.jsx, RegisterPage.jsx       # Small pages kept as single files
│   ├── {Nome}Page.jsx                         # One-line shim re-exporting './{Nome}/index.jsx'
│   └── {Nome}/                                # Page folder (see "Page folder convention" below)
│       ├── index.jsx
│       ├── use{Nome}.js
│       ├── components/
│       └── utils/
├── services/                    # Axios client with auth interceptor
├── utils/                       # Generic helpers (money, dates, Excel export)
└── App.jsx

## Responsibilities

Controllers:

* HTTP handling only

Services:

* Business rules

Routes:

* Endpoint mapping

Middlewares:

* Cross-cutting concerns

Utils:

* Generic helpers

Context:

* Global React state

Components:

* Reusable UI

Pages:

* Route-level screens.
* Complex pages use a "page-as-orchestrator" folder layout — see `frontend/docs/frontend-architecture-guide.md` for the progressive complexity policy (Level 1/2/3), per-type conventions, and the page-refactoring playbook. The single `*Page.jsx` file is a one-line shim that re-exports the page folder's `index.jsx` so existing imports keep working.

## Page folder convention

Each page folder under `src/pages/{Nome}/` has the same shape:

```text
pages/{Nome}/
├── index.jsx               # Orquestrador (~60-150 linhas): hook call + composition of subcomponents
├── use{Nome}.js            # Estado + API + handlers de mutação
├── components/             # Subcomponentes locais (tabela, modal, form, badge, ...)
└── utils/
    └── {nome}Helpers.js    # Funções puras (formatters, validators, cálculos)
```

Rules:

- `index.jsx` must not call `api.*` directly; all I/O lives in `use{Nome}.js`.
- Subcomponents receive data and callbacks via props; no global state and no `useEffect` that fetches data.
- Helpers in `utils/` are stateless — if a function needs React hooks it belongs in `use{Nome}.js`.
- Shared widgets (`ActionMenu`, `ConfirmDialog`, `Toast`) live in `src/components/`; page-only widgets stay in the page folder.

## File Naming

Use descriptive names.

Examples:

* authController.js
* paymentService.js
* ordersRoutes.js
* LoginPage.jsx

Avoid generic names.

Examples:

* helper.js
* misc.js
* util.js

## Imports

Prefer absolute imports when project configuration supports them.

Keep import ordering consistent.

## Code Organization

One responsibility per file.

Avoid large files with mixed concerns.

## Maintainability

Favor readability over clever implementations.

Business rules must remain easy to locate and test.
