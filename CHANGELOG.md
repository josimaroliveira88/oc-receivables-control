# Changelog

All notable changes to the Receivables Control System are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Guidance for maintainers:

- This changelog does **not** keep a running `## [Unreleased]` section. When the user signals more adjustments may follow, the agent records what was just done in `NOTES.md` instead of editing `CHANGELOG.md`. When the user signals that no more adjustments are pending, those notes are consolidated into a new dated `## Phase N` section (most recent at the top) and grouped under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` as applicable. The agent then clears the entries from `NOTES.md`. See the **New Feature Workflow** in `AGENTS.md` for the full protocol.
- Keep each entry concise and actionable; refer to `AGENTS.md` for rules and `ARCHITECTURE.md` for system structure.
- Monetary amounts are in Brazilian Real (BRL) unless stated otherwise.


## Phase 50 — Move order tracking link to order number (2026-08-20)

### Changed
- Removed the separate "Rastreio" column from Gestão de Pedidos and moved its tracking link to the "Número" column, using the order number to build the URL.
- Increased the "Número" column width to 11%, prevented long order numbers from wrapping, reduced the external-link icon, and right-aligned the column on desktop while preserving left alignment on mobile. The number and icon use fixed visual areas so order numbers of different lengths remain aligned.

### Tests
- Updated `frontend/tests/OrdersPage.test.jsx` to verify the tracking links are attached to each order number and that the separate column is absent.
- Verified: 322 frontend tests passing, `npm run build` clean, and Prettier `format:check` clean.


## Phase 49 — Unify Receivables into the Orders page (2026-08-20)

### Changed
- Removed the "Recebíveis" menu item (header and mobile drawer), the `/receivables` route, and the `ReceivablesPage` shim, unifying receivables management under the "Pedidos" page (`/orders`), since the two lists were practically identical and differed only in their actions.
- The unified orders list now shows the columns: Número, Data, Responsável, Tipo Pgto, Valor, Valor Pendente, PV Total, Descrição, Rastreio, Status, Ações. Row actions are now: Registrar Pagamento (or "Dar baixa", shown conditionally), Detalhar Pagamentos, Editar, and Excluir.
- Payment registration and the per-person details modal were carried over exactly as implemented, preserving their behavior unchanged; only the action label "Detalhar" was renamed to "Detalhar Pagamentos".
- `frontend/src/pages/Orders/`: `useOrders.js` now exposes `refreshOrders` (refetch orders after a payment); new `useOrderPayments.js` hook owns the payment and details state; `PaymentModal.jsx`, `DetailsModal.jsx`, and `utils/receivablesHelpers.js` were moved in from the removed `Receivables/` folder; `OrdersTable.jsx` gained the "Valor Pendente" column and the two new actions; `index.jsx` composes both hooks and renders the payment/details modals and the overpayment confirmation.
- `frontend/src/App.jsx` (removed route), `frontend/src/components/Header.jsx` and `MobileDrawer.jsx` (removed nav item and unused icon import), and `frontend/src/components/OnboardingTour.jsx` (payment step now points to `/orders`).
- `ARCHITECTURE.md`: page tree updated to reflect the merged `Orders/` folder and the removal of `Receivables/`.

### Removed
- `frontend/src/pages/Receivables/` (index.jsx, useReceivables.js, components/, utils/receivablesHelpers.js) and the `frontend/src/pages/ReceivablesPage.jsx` shim.

### Tests
- `tests/OrdersPage.test.jsx` updated for the new action set and the added "Valor Pendente" column.
- New `tests/OrdersPayments.test.jsx` covers payment registration, overpayment confirmation, and the details modal (migrated from the removed `tests/ReceivablesPage.test.jsx`).
- `tests/Header.test.jsx` and `tests/MobileDrawer.test.jsx` updated for the removal of the "Recebíveis" nav item.
- Verified: 321 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.

## Phase 48 — Frontend documentation and architecture guide (2026-08-14)

### Changed
- Renamed `frontend/docs/refactoring-guide.md` to `frontend/docs/frontend-architecture-guide.md` (English) and turned it into the single frontend structure reference for every change (new feature, improvement, or maintenance).
- The guide now defines a progressive complexity policy (Level 1 single file → Level 2 point extraction → Level 3 page orchestrator), conventions per file type (pages, components, hooks, utils, shared components), and rules for any request (assess before editing, do not push a file past its threshold, extract in the same change, preserve an adequate structure, do not over-split simple files, verify after structural changes), keeping the page-refactoring playbook, anti-patterns, and post-refactoring checks.
- `ARCHITECTURE.md`: repository structure tree and the "page-as-orchestrator" design decision now reference the new guide.
- `AGENTS.md`: updated the current-state phase range to 17-47 and replaced the page-size pitfall with a pointer to `frontend/docs/frontend-architecture-guide.md` as the single frontend structure reference.
- Skills `frontend-react` and `project-structure` now point to the new guide for the complexity policy, per-type conventions, and the refactoring playbook.

### Tests
- Documentation-only change: no test or source-code behavior changed. Verified: Prettier `format:check` clean.

## Phase 47 — Page refactoring to orchestrator architecture (2026-08-14)

### Changed
- Refactored all five main pages into a "page-as-orchestrator" architecture following a new reusable roadmap in `frontend/docs/refactoring-guide.md`: each page folder now holds a custom hook (state, API calls, handlers), local subcomponents, and pure helpers, while the original `*Page.jsx` file becomes a compatibility shim (`export { default } from './{Nome}/index.jsx';`) so existing imports keep working.
- PeoplePage (581 lines): extracted `usePeople.js`, `PeopleTable.jsx`, `PersonModal.jsx`, `PersonForm.jsx`, `PersonFormFields.jsx`, `WhatsappField.jsx`, `SimNaoSelect.jsx`, `BoolBadge.jsx`, and `utils/peopleHelpers.js`.
- OrdersPage (977 lines): extracted `useOrders.js`, `OrdersTable.jsx`, `OrderModal.jsx`, `OrderForm.jsx`, `OrderItemFields.jsx`, `ProductCombobox.jsx`, `Badges.jsx`, and `utils/orderHelpers.js`.
- ProductsPage (923 lines): extracted `useProducts.js`, `ProductsTable.jsx`, `ProductModal.jsx`, `ProductForm.jsx`, `StatusBadge.jsx`, and `utils/productHelpers.js` (including client-side filter/sort helpers).
- ReceivablesPage (971 lines): extracted `useReceivables.js`, `ReceivablesTable.jsx`, `PaymentModal.jsx`, `DetailsModal.jsx`, `StatusBadge.jsx`, and `utils/receivablesHelpers.js`.
- DashboardPage (295 lines → ~90): extracted `useDashboard.js`, `DashboardHeader.jsx`, `KpiCards.jsx`, `BalanceChart.jsx`, `YearlyBreakdown.jsx`, and `utils/dashboardHelpers.js` (BRL formatters, `hasDashboardData`, `buildChartData`).
- Created `frontend/docs/refactoring-guide.md` documenting when to apply the refactor (line count / responsibility-mixing criteria), the step-by-step extraction process, the final folder structure, and anti-patterns to avoid.

### Tests
- All existing page suites (PeoplePage, OrdersPage, ProductsPage, ReceivablesPage, DashboardPage) pass unchanged, preserving every `data-testid`, visible PT-BR text, and event-handler behavior.
- Verified: 321 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.

## Phase 46 — Edit all product fields except code (2026-08-14)

### Changed
- The product edit modal now exposes every editable field: name, size, regular price, member price, PV, URL, and status, all pre-filled from the selected product.
- Submitting the edit sends the three price fields as numbers via `PUT /api/products/:id`; the backend already supported the update and keeps the existing price-history versioning (unchanged prices do not create a new `ProductPrice` record).
- The product code remains immutable: the code field is disabled in the UI and the backend never updates `Product.code`.

### Fixed
- Infinite scroll on the products page stopped working after creating or editing a product: the list refetch set the loading state, which unmounted the scroll sentinel and disconnected the `IntersectionObserver`, but the effect did not re-run because its dependencies were unchanged. The observer effect now depends on `loading` and re-attaches to the new sentinel after a refetch, and the visible count resets to the page size so the updated list starts from the top.

### Tests
- `ProductsPage.test.jsx`: updated the edit-form tests to assert the full `PUT` payload (including prices) and added a price-change test; the pre-fill test now also asserts the price inputs.
- ProductsPage suite: added a regression test that creates a product while infinite scroll is active and asserts the sentinel observer is re-attached (triggering it reveals more rows); the mock `IntersectionObserver` now tracks the observed node and only fires while it remains connected to the DOM.
- Verified: 168 backend + 321 frontend tests passing, `npm run build` clean, Prettier `format:check` clean.


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
