# Receivables Control System: Agent Guide

## Current State

MVP and Phases 1-80 are complete (see `CHANGELOG.md`). The application provides authenticated, user-isolated client, order, receivables, payment, dashboard, export, stock, and dōTERRA product-catalog workflows, including KIT products with per-component stock control.

- Internal documentation and code comments: English.
- User-facing content: Brazilian Portuguese (PT-BR).
- Last recorded test result: 621 backend + 714 frontend = 1335 passing tests.

## Stack and Ports

- Backend: Node.js, Express, Prisma, Zod, JWT, PostgreSQL 15.
- Frontend: React 18, Vite, Tailwind CSS 3, Flowbite plugin, Recharts, SheetJS, lucide-react, react-icons (brand icons, e.g. WhatsApp/Instagram), react-number-format (ATM-style currency masks via `CurrencyInput`).
- Infrastructure: Docker Compose; Adminer is included for database inspection.
- Tooling: Prettier 3 for code formatting, ESLint 9 for code quality (per-workspace flat configs).
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
- Preserve transactional consistency and order status transitions: `PENDENTE` -> `PARCIAL` -> `QUITADO`. Orders flagged `isTeamOrder` are an exception: `computeOrderStatus` always returns the dedicated `EQUIPE` status (never one of the three standard states), and team orders are excluded from all dashboard metrics, generate no stock movements, and reject payments. Toggling a team order back to normal recomputes the standard status.

### Data isolation and security

- All application routes require JWT authentication unless explicitly public (`/health`, login, registration).
- Scope every Person, Order, Item, Payment, and related lookup by `req.user.userId`.
- Never expose passwords or bypass ownership checks.

### TDD

- For phases 5 and later, write backend or frontend tests before business logic.
- Cover validation, financial edge cases, authorization, status transitions, and transactional behavior.
- Run the relevant suite and the full suite before declaring work complete. Do not add untestable business logic.

## Design Principles (SOLID)

Apply SOLID pragmatically. The goal is a market-standard, maintainable design — not rule-following for its own sake. Adopt a principle when it adds clarity, cohesion, or testability; skip it when it brings no real gain. Maintenance is also the moment to correct past shortcuts: when a change touches code where a principle was previously not applied, refactor toward it right there, keeping the refactor scoped to the change being made.

- **Single Responsibility** — one reason to change per module: thin controllers handle HTTP, services hold business rules, pure `utils/` helpers derive values, hooks orchestrate state and API calls.
- **Open/Closed** — extend behavior through new modules or options (filters, sorters, validators) instead of editing well-tested core functions.
- **Liskov Substitution** — keep statuses/enums and shape-like contracts substitutable: any function that accepts a given shape must work with every variant the codebase can produce.
- **Interface Segregation** — keep Zod schemas and helper contracts per-domain/per-endpoint; consumers depend only on the fields they need.
- **Dependency Inversion** — services and helpers depend on stable contracts (Prisma models, plain data shapes, exported factories/helpers), never on Express/HTTP details or a concrete caller's internals.

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
npm run lint                        # ESLint on backend and frontend
npm run lint:fix                    # ESLint --fix on backend and frontend
npm run format                      # Prettier --write the whole repo
npm run format:check                # Prettier --check (CI-style verification)
```

Per-workspace lint (faster when working in one side):

```text
cd backend && npm run lint          # Backend ESLint
cd frontend && npm run lint         # Frontend ESLint (JS/JSX)
```

ESLint owns code-quality rules (unused vars, undef globals, React hooks rules); Prettier owns formatting. The two are disjoint by design: the ESLint configs end with `eslint-config-prettier` so no formatting rule ever conflicts with Prettier. Run both before declaring work complete.

Catalog loader:

```text
cd backend && npm run load:products -- [csv-path] [--date YYYY-MM-DD] [--dry-run]
```

The loader deactivates active products absent from the CSV. Always use the complete catalog and run `--dry-run` first.

## Commit Conventions

- Use **Conventional Commits**: `type(scope): subject` in English, lowercase subject, imperative mood, no trailing period.
- Types seen in this repo: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `config`.
- Scope names the affected area, e.g. `orders`, `people`, `products`, `sales`, `stock`, `payments`, `currency`, `auth`, `ui`, `frontend`, `backend`, `export`, `config`.
- Group work per phase in small, focused commits: a `test(...)` commit covering the tests, a `feat(...)`/`fix(...)` commit for the behavior, and a `docs:` commit for the `CHANGELOG.md` entry when the phase is promoted. See the feature-grouped history (e.g. Phase 71–74) as the reference.
- `NOTES.md` stays tracked by git but is **never committed**: update it freely following the template at the top of the file, but never stage or include it in a commit, even when it has pending changes. Backend refactoring phases therefore land as a single `refactor(<scope>): ...` commit that includes only the code change; the matching `NOTES.md` entry stays uncommitted in the working tree until it is consolidated into `CHANGELOG.md`.
- Never commit secrets, build artifacts, `node_modules`, or generated uploads. Commit only intended, related files.
- Only commit, amend, push, or create PRs when explicitly requested by the user.

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
- Preserve the z-index hierarchy: navigation `z-50`, modals `z-[60]` (the shared `components/Modal.jsx` owns this), confirmation/tour overlays `z-[70]`, action menus `z-[80]`, toasts `z-[90]`.
- Use the shared `components/Modal.jsx` for every modal/dialog. It centralizes the `z-[60]` backdrop, backdrop click, Escape, and the **polite close**: closing via backdrop, Escape, or the `×`/Cancel button checks `isDirty`; if there are unsaved changes it opens the discard `ConfirmDialog`, otherwise it closes immediately. Read-only modals pass no `isDirty`. `submitting` blocks closing. Compute `isDirty` with `useDirtyForm(values, snapshot)` — the caller captures a snapshot when the modal opens and clears it on close/success (`utils/formChanges.js` `hasFormChanges` does the deep comparison). Pass form children as a render prop `(requestClose) => ...` so Cancel buttons route through the same check.
- In ESM Tailwind config, import Flowbite as `flowbite/plugin.js`.
- Keep `prettier` declared in the `package.json` of each workspace that owns source files (root, `backend/`, `frontend/`) so the binary resolves in the local `node_modules/.bin`.
- On **Windows**, `npx prisma generate` can fail with `EPERM` renaming `query_engine-windows.dll.node` when the backend Node process, VS Code's TS server, or Windows Defender is locking the DLL. Kill `node.exe`, close VS Code, delete `backend/node_modules/.prisma/client`, retry; if it still fails, exclude `node_modules/.prisma` from Defender. See `docs/DEPLOYMENT.md` step 6 for the full procedure.
- `frontend/docs/frontend-architecture-guide.md` is the single frontend structure reference: it defines the progressive complexity policy (Level 1 single file → Level 2 point extraction → Level 3 page orchestrator), conventions per file type, and rules for any request. Apply it to every frontend change — new feature, improvement, or maintenance — so files stay cohesive and don't grow past their threshold (the ~400-line trigger is a review signal, not the only one).
- KIT products have their composition in `KitComposition`, but order items **freeze** it into `Item.kitSnapshot` at creation time; `expandItemToStockProducts` (in `utils/kitStock.js`) is the single expansion used by `itemStockMovements`, the stock diff, and item/order deletion, so kit vs components modes and quantity changes stay consistent. Never recompute a snapshot from the live kit when editing an existing order item whose product is unchanged — that would break requirement 5.
- Order attachments (dōTERRA order screenshots) are stored under `backend/uploads/orders/` (gitignored), with `ATTACHMENTS_DIR` env override used by tests. Serve them only through the authenticated `GET /api/orders/:id/attachment` endpoint (ownership check first); never expose them via static middleware. The stored filename is always a server-generated UUID + whitelisted extension (PNG/JPEG/WebP), so `path.join` never receives client input. Size is validated per-request against `ATTACHMENT_MAX_BYTES` (default 10 MB). Keep `PaymentType` in sync between the Prisma enum and the Zod `paymentTypeSchema` in `ordersController.js`.
- `updateOrder` syncs items **by id** (updates kept items preserving `kitSnapshot`, creates new ones, deletes removed ones). The frontend sends the existing item's UUID in `itemPayload`; keep that contract when adding order-item payload fields.
- When deleting test products that participate in `KitComposition`, delete the composition rows first (the `componentProductId` FK is `ON DELETE RESTRICT`), otherwise shared-DB suites like `productLoader.test.js` fail with `P2003`.
- The frontend palette is token-driven: consume the semantic Tailwind colors defined in `frontend/tailwind.config.js` (`bg-base`/`bg-surface`, `border-line`, `text-ink`/`ink-soft`/`ink-faint`, `accent`, `success`/`warning`/`info`/`mystic`/`danger`, `badge-*`) backed by the CSS variables in `frontend/src/index.css`. Never reintroduce raw palette classes (`gray-*`, `blue-*`, `primary-*`, `emerald-*`) or hex literals for theme/status colors, and put badge/status class maps in `frontend/src/utils/badgeStyles.js` rather than duplicating them. Dark mode is the `.dark` class on `<html>` owned by `ThemeContext` (+ the pre-render IIFE in `main.jsx`); tokenized elements must not need `dark:` variants. After changing any token value, run `node scripts/contrast-check.mjs` in `frontend/` (WCAG AA ≥ 4.5:1) in addition to the usual checks.

## New Feature Workflow

1. Define acceptance criteria and test cases first; keep money in integer cents and preserve user data isolation.
2. Write tests first, then implement the smallest correct change using existing patterns.
3. Run backend and frontend tests (`npm run test` in both `backend/` and `frontend/`); run `npm run lint`; run `npm run build` for frontend changes; run `npm run format:check`.
4. Before declaring the adjustment finished in `CHANGELOG.md`, **stop and ask the user**:

   > Você tem mais algum ajuste a adicionar nesta versão?

   - If the user answers **yes**, append a note block to `NOTES.md` (template at the top of that file) describing what was just changed — files touched, tests added/updated, and the verification result — and end the turn. Do **not** edit `CHANGELOG.md`.
   - If the user answers **no** (in the current session or in a follow-up coding session), consolidate every entry in `NOTES.md` together with the just-completed work into a single new dated `## Phase N` section at the top of `CHANGELOG.md`. Group items under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Tests` as appropriate. Then delete the consolidated entries from `NOTES.md`.

   Once the user has answered, **act directly on the chosen branch above with no further analysis**: just run the described file edits. There is no need to think deeply about wording, ordering, or whether to keep `NOTES.md`; the guideline already covers it.
5. Update `ARCHITECTURE.md` or this file only when their scope changes.
