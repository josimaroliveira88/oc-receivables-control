# Receivables Control System: Agent Guide

## Current State

MVP and Phases 17-48 are complete. The application provides authenticated, user-isolated client, order, receivables, payment, dashboard, export, and dōTERRA product-catalog workflows.

- Internal documentation and code comments: English.
- User-facing content: Brazilian Portuguese (PT-BR).
- Last recorded test result: 287 backend + 419 frontend = 706 passing tests.

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

The project no longer maintains a running `## [Unreleased]` section in `CHANGELOG.md`. After each completed adjustment:

1. **Do not** edit `CHANGELOG.md` until the user confirms no more adjustments are pending for this version. Use `NOTES.md` instead — see step 4 of the **New Feature Workflow** below.
2. **Do** update `ARCHITECTURE.md` whenever structure, APIs, configuration, or major design decisions change.
3. **Do** update this file whenever agent rules, commands, dependencies, or technical constraints change.
4. Keep historical detail out of these operational guides — it belongs in the changelog only.

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
- Preserve the z-index hierarchy: navigation `z-50`, modals `z-[60]`, confirmation/tour overlays `z-[70]`, action menus `z-[80]`, toasts `z-[90]`.
- In ESM Tailwind config, import Flowbite as `flowbite/plugin.js`.
- Keep `prettier` declared in the `package.json` of each workspace that owns source files (root, `backend/`, `frontend/`) so the binary resolves in the local `node_modules/.bin`.
- `frontend/docs/frontend-architecture-guide.md` is the single frontend structure reference: it defines the progressive complexity policy (Level 1 single file → Level 2 point extraction → Level 3 page orchestrator), conventions per file type, and rules for any request. Apply it to every frontend change — new feature, improvement, or maintenance — so files stay cohesive and don't grow past their threshold (the ~400-line trigger is a review signal, not the only one).

## New Feature Workflow

1. Define acceptance criteria and test cases first; keep money in integer cents and preserve user data isolation.
2. Write tests first, then implement the smallest correct change using existing patterns.
3. Run backend and frontend tests (`npm run test` in both `backend/` and `frontend/`); run `npm run build` for frontend changes; run `npm run format:check`.
4. Before declaring the adjustment finished in `CHANGELOG.md`, **stop and ask the user**:

   > Você tem mais algum ajuste a adicionar nesta versão?

   - If the user answers **yes**, append a note block to `NOTES.md` (template at the top of that file) describing what was just changed — files touched, tests added/updated, and the verification result — and end the turn. Do **not** edit `CHANGELOG.md`.
   - If the user answers **no** (in the current session or in a follow-up coding session), consolidate every entry in `NOTES.md` together with the just-completed work into a single new dated `## Phase N` section at the top of `CHANGELOG.md`. Group items under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Tests` as appropriate. Then delete the consolidated entries from `NOTES.md`.

   Once the user has answered, **act directly on the chosen branch above with no further analysis**: just run the described file edits. There is no need to think deeply about wording, ordering, or whether to keep `NOTES.md`; the guideline already covers it.
5. Update `ARCHITECTURE.md` or this file only when their scope changes.
