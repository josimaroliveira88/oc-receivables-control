# Receivables Control System: Agent Guide

## Current State

MVP and Phases 17-44 are complete. The application provides authenticated, user-isolated client, order, receivables, payment, dashboard, export, and dōTERRA product-catalog workflows.

- Internal documentation and code comments: English.
- User-facing content: Brazilian Portuguese (PT-BR).
- Last recorded test result: 168 backend + 319 frontend = 487 passing tests.

## Stack and Ports

- Backend: Node.js, Express, Prisma, Zod, JWT, PostgreSQL 15.
- Frontend: React 18, Vite, Tailwind CSS 3, Flowbite plugin, Recharts, SheetJS, lucide-react.
- Infrastructure: Docker Compose; Adminer is included for database inspection.
- Tooling: Prettier 3 for code formatting.
- Frontend: `http://localhost:3000`.
- Backend: `http://localhost:4000`, API prefix `/api`.
- Database: `localhost:5432`.
- Adminer: `http://localhost:8080`.

## Non-Negotiable Rules

### Financial correctness

- Use integer cents for all application-layer monetary arithmetic (`toCents`, `fromCents`, `formatBRL`).
- Persist monetary values as Prisma `Decimal(10,2)`; Prisma commonly returns Decimal values as strings, so normalize before calculations or formatting.
- Never compare or sum BRL values with raw floating-point arithmetic.
- Payments allow overpayment after explicit frontend confirmation. A zero payment is valid only for a person whose item total is zero. Negative payments are invalid.
- Preserve transactional consistency and order status transitions: `PENDENTE` -> `PARCIAL` -> `QUITADO`.

### Data isolation and security

- All application routes require JWT authentication unless explicitly public (`/health`, login, registration).
- Scope every Person, Order, Item, Payment, and related lookup by `req.user.userId`.
- Never expose passwords or bypass ownership checks.

### TDD

- For phases 5 and later, write backend or frontend tests before business logic.
- Cover validation, financial edge cases, authorization, status transitions, and transactional behavior.
- Run the relevant suite and the full suite before declaring work complete. Do not add untestable business logic.

## Commands

Run from the indicated directory unless stated otherwise:

```text
docker compose up --build       # Start db, backend, frontend, and Adminer
cd backend && npm run dev       # Backend with nodemon
cd frontend && npm run dev      # Frontend with Vite
cd backend && npm run test      # Backend Vitest suite (serial DB files)
cd frontend && npm run test     # Frontend Vitest/RTL suite
cd backend && npm run test:watch
cd frontend && npm run test:watch
npm run format                      # Prettier --write the whole repo
npm run format:check                # Prettier --check (CI-style verification)
```

Catalog loader:

```text
cd backend && npm run load:products -- [csv-path] [--date YYYY-MM-DD] [--dry-run]
```

The loader deactivates active products absent from the CSV. Always use the complete catalog and run `--dry-run` first.

## Documentation Rules

After a completed feature:

1. Update `CHANGELOG.md` with status, acceptance criteria, and a short completion note.
2. Update `ARCHITECTURE.md` only when structure, APIs, configuration, or major design decisions change.
3. Update this file only when agent rules, commands, dependencies, or technical constraints change.
4. Keep historical detail in the roadmap, not in this operational guide.

## High-Value Pitfalls

- Vitest mocks are hoisted: use lazy arrow wrappers in `vi.mock()` factories; use `vi.hoisted()` when an imported module invokes the mock during module evaluation.
- In jsdom, submit required-field tests with `fireEvent.submit(form)` when testing custom validation.
- Skip `dotenv.config()` during tests so test environment variables are not overwritten.
- Use React Router v6 `<Outlet />` layouts instead of nested `<Routes>` wrappers.
- Prisma transaction reads are stale after a create; include the new payment explicitly when recomputing status.
- Parse `YYYY-MM-DD` dates as local dates; do not use `new Date('YYYY-MM-DD')` for Brazilian date display.
- After schema changes, run `npx prisma generate` in the environment that runs tests.
- Use `npx prisma migrate deploy` on databases containing data. Never use `prisma migrate dev` there.
- Hand-edit Prisma rename migrations to use `RENAME COLUMN`; generated drop/add SQL can destroy data.
- Keep backend Vitest `fileParallelism: false` because test files share one database.
- Preserve the z-index hierarchy: navigation `z-50`, modals `z-[60]`, confirmation/tour overlays `z-[70]`, action menus `z-[80]`.
- In ESM Tailwind config, import Flowbite as `flowbite/plugin.js`.
- Keep `prettier` declared in the `package.json` of each workspace that owns source files (root, `backend/`, `frontend/`) so the binary resolves in the local `node_modules/.bin`.

## New Feature Workflow

1. Add a planning block under `## [Unreleased]` in `CHANGELOG.md` (template provided there) with goal, acceptance criteria, and tests.
2. Define acceptance criteria and test cases first; keep money in integer cents and preserve user data isolation.
3. Write tests first, then implement the smallest correct change using existing patterns.
4. Run backend and frontend tests (`npm run test` in both `backend/` and `frontend/`); run `npm run build` for frontend changes.
5. On completion, move the `## [Unreleased]` entry to a new dated section in `CHANGELOG.md`.
6. Update `ARCHITECTURE.md` or this file only when their scope changes.
