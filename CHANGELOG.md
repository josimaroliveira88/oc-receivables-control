# Changelog

All notable changes to the Receivables Control System are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Guidance for maintainers:

- Append a new entry under `## [Unreleased]` for work in progress.
- When a milestone (phase or group of phases) is delivered, move its entry to a dated `##` section and group changes under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` as applicable.
- Keep each entry concise and actionable; refer to `AGENTS.md` for rules and `ARCHITECTURE.md` for system structure.
- Monetary amounts are in Brazilian Real (BRL) unless stated otherwise.

### Phase planning template

When a new request is approved, add the planning block below to the `## [Unreleased]` entry until delivery:

```markdown
## Phase 45: Feature Name
Status: IN PROGRESS

### Goal
Why the feature is needed.

### Acceptance Criteria
- [ ] User-facing behavior and PT-BR labels
- [ ] Backend/API and data rules
- [ ] Edge cases and authorization behavior
- [ ] Backend/frontend tests written before implementation

### Technical Notes
- Schema, migration, dependency, or environment changes.

### Completion
- Tests and build results.
- Documentation updated.
```

## [Unreleased]


## Phase 45 — Replace window.confirm with ConfirmDialog (2026-08-14)

### Added
- Prettier 3 support (root, `backend/`, `frontend/`): `prettier` pinned as a devDependency in every workspace, root `.prettierrc` (single quotes, semicolons, trailing commas, 80 cols) and `.prettierignore`, and `npm run format` / `npm run format:check` scripts.

### Changed
- Replaced browser-native `window.confirm` prompts with the shared `ConfirmDialog` component on PeoplePage delete, OrdersPage delete, and ProductsPage inline status change, following the ReceivablesPage overpayment-confirmation pattern.
- Each dialog shows a PT-BR title/message, confirm label ("Excluir" for deletes, "Confirmar alteração" for product status), and "Cancelar"; the confirm button shows "Processando..." and Cancel/Esc are disabled while the API call is in flight.
- Success toasts added for delete and status-change operations.

### Tests
- Updated PeoplePage, OrdersPage, and ProductsPage suites to interact with the dialog buttons instead of stubbing `window.confirm`; test renders now wrap pages in `ToastProvider`.
- Verified: 168 backend + 319 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.

## Phases 1-16 — MVP Foundation

### Added
- Docker Compose environment with PostgreSQL 15 and Adminer; one command (`docker compose up --build`) starts all services.
- Prisma schema and migrations for `User`, `Person`, `Order`, `Item`, and `Payment` with cascade rules.
- Express backend with JWT login, `auth` middleware, protected routes, and centralized Zod error handling.
- React SPA with Vite, Tailwind CSS, login page, `AuthContext`, `ProtectedRoute`, and an `AppLayout` using the React Router v6 `<Outlet />` pattern.
- People CRUD with create/edit modals and delete confirmation (PT-BR).
- Orders CRUD with a dynamic multi-row item sub-form and total calculation; nested item add/update/delete recalculates `Order.totalValue`.
- Receivables tracking page with status badges (`Pendente`, `Parcial`, `Quitado`) and per-person payment modal.
- Financial engine: `POST /api/orders/:orderId/payments` creates payments inside a Prisma transaction, validates `amount` against pending balance, and recomputes order status (`PENDENTE` → `PARCIAL` → `QUITADO`); `GET /api/orders/:orderId/balance` returns per-person pending amounts.
- Dashboard with KPI widgets, Recharts bar chart of balances by person, and navigation link.
- Excel export (`xlsx`) producing a four-sheet workbook (`Pedidos`, `Pessoas`, `Histórico de Pagamentos`, `Saldo Pendente`) with BRL-formatted cells and browser download.
- Toast notification system with success/error types and auto-dismiss.
- Vitest + React Testing Library suites established from Phase 5 onward with TDD discipline.

### Fixed
- Floating-point precision regressions in financial comparisons by introducing shared `src/utils/money.js` helpers (`toCents`, `fromCents`, `formatBRL`) and integer-cents arithmetic in backend and frontend.
- `formatBRL` to parse Prisma `Decimal` string values before formatting with `Intl.NumberFormat`.

## Phases 17-25 — Dates, Multi-Tenancy, and UX Foundation

### Added
- Custom `orderDate` (Phase 17) and `paidAt` (Phase 18) fields parsed as local dates via `parseLocalDate()` to avoid UTC day shifts; default to the current timestamp when omitted.
- Dashboard yearly breakdown (Phase 19) grouping pending/quitado totals by `orderDate` year, sorted descending.
- Multi-user registration endpoint `POST /api/auth/register` (Phase 20) with bcrypt hashing and duplicate detection.
- Backend data isolation (Phase 21): `userId` made required on `Person` and `Order` with `ON DELETE CASCADE`; every controller and route scoped by `req.user.userId`; cross-user access blocked.
- Frontend registration UI (Phase 22) with PT-BR form, validation, and login navigation.
- Responsive header (Phase 23) with gradient design, desktop `<NavLink>` highlighting, and mobile bottom navigation using `lucide-react` icons.
- Mobile UX tweaks (Phase 24): `autoCapitalize="none"` on username inputs and `Eye`/`EyeOff` password visibility toggles.
- Dark mode and unified design system (Phase 24): `ThemeContext` with localStorage persistence, `primary` Tailwind tokens, gradient buttons, glassmorphism modals, and dark variants across the app.
- Logged-in user badge (Phase 25) in the header and mobile nav, decoded client-side via `jwt-decode`.
- Docker startup improvements (Phase 25): `npm install` runs on container start in both frontend and backend so anonymous volumes receive new dependencies after rebuild.

### Fixed
- Z-index conflict (Phase 26) between modals and the mobile navigation by raising modal overlays to `z-[60]` and documenting the hierarchy.

## Phase 26 — Onboarding

### Added
- Interactive nine-step onboarding tour triggered on first login after registration, with manual restart via a header `HelpCircle` button and the mobile drawer `Tutorial` item; state persisted in `localStorage` and cross-page navigation during the tour.

## Phases 27-30 — Product Catalog

### Added
- `Product` and `ProductPrice` models (Phase 27) with price history via `validFrom`/`validTo` intervals, `Decimal(10,2)` fields, and a back-reference from `Product` to its items.
- Idempotent CSV diff loader (`npm run load:products`) supporting `--date YYYY-MM-DD` retroactive validity and `--dry-run` preview; loader tests snapshot and restore the real catalog so the suite never disables real products.
- Product CRUD API at `/api/products` (Phase 28) with immutable `code`, price-history-preserving updates, and soft-delete.
- `ProductsPage` UI with create/edit modals, status badges, and deactivation actions.
- Mobile drawer navigation (`MobileDrawer.jsx`) replacing the fixed bottom nav, plus a `Produtos` link in the desktop header; onboarding tour extended to nine steps.
- Product search, sorting, and infinite scroll (Phase 29) via `q`, `sortBy`/`sortDir`, and `page`/`pageSize` returning `{ data, pagination }`.
- Client-side load-once catalog (Phase 30): `pageSize=all` returns the full list; the page fetches once and applies search, status filter, and sorting in-memory with `useMemo`; infinite scroll slices the in-memory list.

### Changed
- `GET /api/products` response shape from a bare array to `{ data, pagination }`.

## Phases 31-35 — Order and Payment Rules

### Added
- Product-linked order items (Phase 31) via a `ProductCombobox` that auto-fills read-only member-price and PV snapshots; editable `chargedValue` and free-text `details` (≤500 chars); `Item.value` renamed to `chargedValue`, `description` became optional, and a `productId` FK with `ON DELETE SET NULL` was added.
- Order descriptive fields (Phase 32): dōTERRA order number placeholder, "Ver pedido no site" tracking link shown on blur, `accountOwner` (≤120), `PaymentType` enum (`PIX`/`BOLETO`/`CARTAO_CREDITO`), `orderNotes` (≤500 with live counter), and live product/PV summary cards above the items; orders list gained Responsável, Tipo Pgto, PV Total, Descrição, and Rastreio columns.
- Zero-value gift `chargedValue` (Phase 33): empty input treated as `0`; backend `itemSchema.chargedValue` uses `min(0).default(0)`; negatives still rejected.
- "Dar baixa" for zero-value persons and overpayment acceptance (Phase 34): backend `paymentSchema.amount` changed to `nonnegative()`, overpayment rejection removed, zero accepted only when `itemSum === 0`, and frontend validation aligned.
- Custom `ConfirmDialog` component (Phase 35) replacing `window.confirm` for overpayment confirmation, with `z-[70]` overlay, PT-BR copy, gradient confirm button, and Escape/backdrop cancellation.

### Changed
- `Payment.amount` validation from `positive()` to `nonnegative()`.
- All financial sums (`Order.totalValue`, payments, dashboard) to read `chargedValue` instead of `value`.

## Phases 36-38 — Client and Receivables Detail

### Added
- Client registration enrichment (Phase 36): `commonGroups`, `whatsapp` (renamed from `contact`, digits-only storage with progressive mask, `wa.me` link, out-of-pattern warning), `instagram`, `address`, `isVip`, and `isDoterraMember`; menu label "Pessoas" → "Clientes"; Excel "Pessoas" sheet renamed to "Clientes" with the new columns.
- Receivables table parity with orders (Phase 37): nine columns including client-side Valor Pendente (`max(0, totalValue − payments)`) and PV Total; shared `formatDateBR` extracted to `frontend/src/utils/dates.js`.
- Payment modal enrichment (Phase 38): always-visible order summary header (Número, Data, Responsável, Valor Total, Valor Pendente, Descrição) and a per-person items list; modal widened with scroll.

### Changed
- `Person.contact` renamed to `Person.whatsapp` via a hand-edited `RENAME COLUMN` migration to preserve data.

## Phases 39-44 — Catalog Statuses, Responsive Lists, and Actions

### Added
- `ProductStatus` enum (Phase 39) replacing the `active` boolean: `ATIVO`, `INDISPONIVEL`, `INATIVO`; nullable `doterraUrl`; three-state filter/badges; "Site" link column; inline status dropdown; orders accept `ATIVO`/`INDISPONIVEL` and reject `INATIVO`; combobox shows `INATIVO` product names on edit via a fallback.
- Flowbite `data-label` responsive cards (Phase 40) for all five tables (Clientes, Pedidos, Recebíveis, Produtos, Dashboard "Resumo por Ano"), eliminating horizontal scrollbars below `md` while keeping semantic table markup and all columns visible.
- Reusable `ActionMenu` kebab component (Phase 41) for the Orders `Ações` column with `default`/`danger` variants, `z-[80]` panel, backdrop/Escape close, and deterministic `data-testid`s; migration playbook added at `docs/ACTION_MENU_REFACTORING_GUIDE.md`.
- Kebab menus (Phase 42) on Clientes (Editar + Excluir) and Produtos (Editar); inline status `<select>` on Produtos preserved alongside the kebab.
- Conditional receivables actions (Phase 43): kebab-only column with primary "Registrar Pagamento" or "Dar baixa" plus "Detalhar" for all orders; muted Valor Pendente when zero.
- Receivables detail modal (Phase 44): order summary header, per-person totals from `/balance`, exclusive accordion with items and received payments, loading/empty states, and responsive dark-mode layout.

### Changed
- Catalog loader deactivation logic to only deactivate `ATIVO` products absent from the CSV, preserving manual `INDISPONIVEL`.

### Removed
- Inline "Editar"/"Excluir" text buttons from table action columns, replaced by the `ActionMenu` kebab.