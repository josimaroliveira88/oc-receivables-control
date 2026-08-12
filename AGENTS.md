# Receivables Control System

## Technology Stack

Backend:
- Node.js
- Express
- Prisma ORM

Frontend:
- React
- Vite
- Tailwind CSS
- Recharts
- SheetJS (xlsx)
- lucide-react
- jwt-decode

Database:
- PostgreSQL 15

Infrastructure:
- Docker

## Ports

Backend: 4000
Frontend: 3000
Database: 5432

Backend API Prefix:
- /api

## Authentication

- Stateless JWT
- Seeded admin user

## Localization

Internal artifacts:
- English

User-facing content:
- Portuguese (Brazil)

## Financial Rules

- Monetary fields must use Decimal(10,2)
- Avoid floating point arithmetic
- Preserve financial consistency

## TDD Methodology (Required from Phase 5 onward)

All phases starting from Phase 5 must follow Test-Driven Development:

1. **Write tests before implementation**: Before writing any business logic, identify and write test cases that define the expected behavior.
2. **Backend tests** (Vitest):
   - Services, financial calculations, validation rules
   - Priority: partial payment, full payment, overpayment acceptance (with confirmation), zero-value "Dar baixa" (only when itemSum = 0; zero against chargeable items is rejected), status transitions, transactional consistency
3. **Frontend tests** (React Testing Library):
   - Forms, authentication flow, protected routes, financial validations
4. **Run tests as verification**: Tests must pass before marking a phase as complete.
5. **Test commands**: Must be documented in AGENTS.md under "Available Test Scripts" and added to `package.json`.

Do not create untestable business logic.

## Documentation Practices

After completing each phase of development, the implementing agent must:

1. Update the project documentation to reflect changes made
2. Ensure ARCHITECTURE.md is current with the latest file structure and setup instructions
3. Update AGENTS.md if any technical specifications or rules change
4. Document any environment variables, configuration changes, or new dependencies
5. Make sure `docs/ROADMAP.md` (located in `docs/` folder, not project root) accurately reflects completed and pending work
6. Document test files and coverage under "## Available Test Scripts"

This ensures future agents can understand the project state and continue development seamlessly.

## Available Test Scripts

Backend:
- `npm run test` - Runs all backend tests with Vitest
- `npm run test:watch` - Runs backend tests in watch mode
- `npm run load:products` - Loads/updates the dōTERRA product catalog from `docs/tabela_produtos_doterra_2026.csv` (idempotent diff). Accepts a custom CSV path: `npm run load:products -- <path>`. Supports `--date YYYY-MM-DD` for retroactive loads (validity start) and `--dry-run` to preview changes without applying them. **Warning**: products present in DB but absent from the CSV are deactivated — always load the complete current catalog, and use `--dry-run` first.

Frontend:
- `npm run test` - Runs all frontend tests with Vitest
- `npm run test:watch` - Runs frontend tests in watch mode

## Key Development Commands

Start development environment:
- `docker compose up --build` - Starts all services (backend, frontend, database, adminer)

Backend only:
- `npm run dev` - Starts backend server with nodemon

Frontend only:
- `npm run dev` - Starts frontend Vite dev server

## Project Status

🎉 **All MVP phases (1-16) + Phases 17-38 have been COMPLETED.**

The Receivables Control System is now fully functional with user self-registration, complete backend data isolation, responsive navigation (desktop top nav + mobile hamburger drawer), a unified design system with dark mode, an interactive onboarding tour, and a full Product CRUD screen. Phase 27 added the global dōTERRA Product catalog with price history and an idempotent diff loader. Phase 28 added the Product CRUD API + ProductsPage UI, and replaced the mobile bottom nav with a hamburger/drawer menu (`MobileDrawer.jsx`) since the menu grew to 5 sections. The onboarding tour now has 9 steps. Phase 29 added product search (name/code), pagination with infinite scroll, sorting by prices/PV, and an active/inactive status filter. Phase 30 moved search/filter/sort fully **client-side**: the frontend loads the entire catalog once (`pageSize=all`) into browser memory and applies search, status filter and sorting in-memory — no new backend call per keystroke or filter change (the catalog is rarely updated). Phase 31 reworked the order item sub-form: each item is now linked to a product from the catalog (filterable combobox), auto-fills the **member price** and **PV** snapshots (read-only), lets the user type the negotiated **Valor Cobrado** (`chargedValue`) and free-text **Detalhes** (up to 500 chars) — the old `value` field was renamed to `chargedValue` and `description` is now optional (auto-filled from the product name). Phase 32 added order-level descriptive fields: the order number placeholder now reads "Informe o número do pedido da dōTERRA" and leaving the field (blur) with a number typed shows a **"Ver pedido no site"** tracking link (`https://status.ondeestameupedido.com/tracking/22747/{numero}/`, new tab); a free-text **Responsável pela conta** (dōTERRA ID or name); a **Tipo de Pagamento** dropdown (PIX / Boleto / Cartão de Crédito, new `PaymentType` enum); a free-text **Descrição do Pedido** (≤ 500 chars); and live **Soma dos Produtos (Valor Cobrado)** + **Soma dos PV** summary cards above the items. The orders list gained columns for Responsável, Tipo Pgto (badge), PV Total, Descrição (truncated + tooltip) and Rastreio (external-link). Phase 33 let the **Valor Cobrado** be **empty/zero** (gifts/brindes) — an empty chargedValue defaults to 0 and negatives are still rejected. Phase 34 reworked the **Registrar Pagamento** modal on the Recebíveis screen so that (a) persons whose items total R$ 0,00 are now listed with \"Nada a receber\" and can be settled with a **\"Dar baixa\"** button that posts a R$ 0,00 payment (order status still travels PENDENTE → PARCIAL → QUITADO), and (b) payments **larger** than the pending balance are now allowed (overpayment after price negotiation) — the backend no longer rejects them and the frontend asks for confirmation (`window.confirm`) before submitting. A R$ 0,00 payment is **only** accepted when the person's items sum to R$ 0,00 (gift items); for a person with chargeable items, an amount strictly greater than zero is required — both backend (`itemSumCents > 0 && amountCents === 0` rejection) and frontend (validation guard showing \"Valor deve ser maior que zero\") enforce the rule. Phase 35 replaced the browser-native `window.confirm` overpayment confirmation with a custom in-app **`ConfirmDialog`** component (`src/components/ConfirmDialog.jsx`) — an HTML modal styled like the rest of the app (amber `AlertTriangle` icon, gradient primary confirm button, gray cancel button, dark-mode aware) that renders when the payment amount exceeds the pending balance; the payment is only posted after the user confirms. 244 frontend tests, 149 backend tests, 393 total. Phase 36 renamed the People screen to **Cadastro de Clientes** (menu label "Clientes") and enriched the client form with, in order: **Nome**, **Grupos em comum** (`commonGroups` — de onde o cliente veio), **WhatsApp** (legacy `contact` column renamed preserving data; digits-only storage, mask `+55 (11) 99999-8888`, pre-filled `+55`, inline out-of-pattern warning, `https://wa.me/{numero}` link in the table), **Instagram** (clickable link), **Endereço** (single field), **Grupo VIP** (Sim/Não) and **Cadastrado/Membro doTERRA** (Sim/Não). Phase 37 expanded the Recebíveis (Controle de Recebíveis) list to mirror the Gestão de Pedidos columns — Número, Data, Responsável, Valor (R$), **Valor Pendente** (computed client-side as `max(0, totalValue − Σ payments)` in integer cents, clamped to R$ 0,00 on overpayment), PV Total, Descrição (truncated + `title` tooltip), Status and Ações (Registrar Pagamento / Pago) — with Tipo Pgto and Rastreio intentionally omitted per client request; no backend changes (GET /api/orders already returns `items[]`/`payments[]`). **262 frontend tests, 158 backend tests, 420 total.** Phase 38 enriched the **Registrar Pagamento** modal with an always-visible **order summary header** (Número, Data, Responsável, Valor Total, Valor Pendente — order-wide `max(0, totalValue − Σ payments)` clamped to R$ 0,00 — and Descrição) plus a **per-person items list** (product description, Valor Cobrado and Detalhes) when a person is selected; no backend changes (client-side from `selectedOrder.items[]`/`payments[]`). **273 frontend tests, 158 backend tests, 431 total.**

### Completed Features:
✅ Multi-container Docker environment (backend, frontend, database, admin UI)
✅ PostgreSQL relational database with Prisma ORM
✅ Express.js backend with JWT authentication
✅ React frontend with Vite and Tailwind CSS
✅ Client management (CRUD) — Cadastro de Clientes (nome, grupos em comum, WhatsApp, Instagram, endereço, VIP, Membro doTERRA)
✅ Orders management with dynamic item sub-forms and custom order date
✅ Payment processing with automatic order status transitions (PENDENTE → PARCIAL → QUITADO), custom payment date, zero-value "Dar baixa" for brindes (only when itemSum = 0), and overpayment acceptance with custom in-app confirmation (`ConfirmDialog.jsx`, replacing `window.confirm`)
✅ Receivables tracking dashboard with per-person balance breakdown
✅ Analytics dashboard with KPI widgets, Recharts visualizations, and yearly breakdown (Pendente/Quitado por ano)
✅ Excel export functionality (4-sheet workbook with BRL formatting)
✅ Comprehensive test coverage (273 frontend tests + 158 backend tests)
✅ Financial precision (integer cents arithmetic, no floating-point errors)
✅ Complete TDD methodology applied across all phases
✅ PT-BR localization for all user-facing content
✅ Multi-user schema foundation (userId on Person/Order)
✅ User registration API endpoint (POST /api/auth/register)
✅ User registration page (RegisterPage.jsx with PT-BR form, client-side validation, navigation)
✅ Login page with "Criar uma conta" link and registration success message
✅ Backend data isolation — all routes JWT-protected, queries filtered by `userId`, cross-user access blocked
✅ `userId` required on Person/Order with `ON DELETE CASCADE` (migration: `20260614184002_make_user_id_required`)
✅ Responsive header with gradient design (`from-blue-800 to-blue-600`)
✅ Mobile hamburger drawer navigation (`MobileDrawer.jsx`) — fixed top bar with hamburger button + slide-in drawer listing all 5 sections (Dashboard, Clientes, Pedidos, Recebíveis, Produtos), Tutorial, theme toggle and Sair. Scales to any number of menu items (replaces the old fixed bottom nav)
✅ Desktop horizontal navigation with `<NavLink>` active state highlighting (incl. Produtos link)
✅ Mobile UX: username inputs default to lowercase (`autoCapitalize="none"`) on virtual keyboards
✅ Password visibility toggle (`Eye`/`EyeOff` icon) on login and registration forms
✅ Logged-in user badge — username displayed as `User` icon + text badge in header (desktop) via `jwt-decode` client-side JWT decoding
✅ Docker `npm install` on container start — frontend `CMD` and backend `entrypoint.sh` run `npm install` before starting, ensuring anonymous node_modules volumes receive new dependencies after `docker compose up --build`
✅ Interactive User Onboarding Tour — step-by-step modal tutorial (9 steps, PT-BR) triggered on first login after registration, with manual restart via `HelpCircle` button in header and "Tutorial" in mobile drawer
✅ Product Catalog (dōTERRA) — global `Product` + `ProductPrice` tables with price history (`validFrom`/`validTo`), idempotent diff loader (`npm run load:products`, supports `--date` retroactive validity and `--dry-run` preview), CSV parser, and 219 products loaded from `docs/tabela_produtos_doterra_2026.csv`
✅ Product CRUD — full backend API at `/api/products` (GET list with `?active=true` filter + current price projection, GET by id, POST create with 409 on duplicate code, PUT update, DELETE soft-delete) + ProductsPage UI with create/edit modals, status badges and Desativar/Ativar actions. **The `code` field is immutable on edit** (disabled input in the UI AND omitted from the update Zod schema — enforced at both layers). Price edits preserve history (old record closed with `validTo`, new record opened). Order-item integration planned for a future phase.
✅ Product search & pagination — `GET /api/products` supports `q` (partial name/code, case-insensitive), `sortBy` (name/code/regularPrice/memberPrice/pv) + `sortDir`, `page`/`pageSize` (default 20, max 100, plus `pageSize=all` to return the entire list), returning `{ data, pagination }`. ProductsPage has a search box with icon, sort dropdown, active/inactive status filter and product count. **Search, status filter and sorting are applied 100% client-side**: the page fetches the whole catalog once (`/products?pageSize=all`) into browser memory, filters/sorts with `useMemo`, and only reveals more rows via **infinite scroll** (IntersectionObserver sentinel slicing 20 at a time) — no new API call per keystroke, filter change or sort change. The backend refetches only after create/edit/deactivate mutations.
✅ Enhanced order item sub-form — each item now links to a product from the dōTERRA catalog via a filterable `ProductCombobox` (client-side name/code search, load-once `GET /products?active=true&pageSize=all`). Selecting a product auto-fills read-only **Valor Membro (R$)** and **PV** snapshot fields; the user types the negotiated **Valor Cobrado (R$)** (`chargedValue`) and free-text **Detalhes** (≤ 500 chars, live `N/500` counter). A **"Limpar produto"** button unlinks the item and clears its snapshot fields. Field order per item: Pessoa → Produto → Valor Membro → Valor Cobrado → PV → Detalhes. On the `Item` model, `value` was renamed to `chargedValue`, `description` is now optional (auto-filled with the product name) and new nullable columns `memberPrice`, `pv`, `details VARCHAR(500)` and `productId` (FK → `Product`, `ON DELETE SET NULL`) were added (migration `20260811190000_extend_item_fields`). `Order.totalValue`, payments and dashboard sums all read `chargedValue`.
✅ Order descriptive fields — the order form now has the dōTERRA number placeholder "Informe o número do pedido da dōTERRA", a clickable **"Ver pedido no site"** tracking link (`https://status.ondeestameupedido.com/tracking/22747/{numero}/`, opens in a new tab) that appears once the field is left (blur) with a number typed, a free-text **Responsável pela conta (ID dōTERRA ou nome)** (`accountOwner`, ≤ 120 chars), a **Tipo de Pagamento** select (PIX / Boleto / Cartão de Crédito, new `PaymentType` enum), a **Descrição do Pedido** textarea (`orderNotes`, ≤ 500 chars, live `N/500` counter), and live **Soma dos Produtos (Valor Cobrado)** + **Soma dos PV** summary cards above the items section (computed client-side, not persisted). The orders list table gained columns: **Responsável**, **Tipo Pgto** (color badge), **PV Total**, **Descrição** (truncated + `title` tooltip) and **Rastreio** (external-link icon opening the tracking URL). New `Order` fields `accountOwner VARCHAR(120)`, `paymentType PaymentType?`, `orderNotes VARCHAR(500)` are all nullable (migration `20260811193000_add_order_descriptive_fields`); the backend Zod schemas validate them (enum + max lengths) and `updateOrder` uses the `!== undefined` spread pattern so an explicit `null` clears a field while an omitted field keeps the existing value.
✅ Custom overpayment confirmation — the overpayment gate on the Recebíveis screen is now a custom in-app HTML modal (`ConfirmDialog.jsx`) instead of the browser-native `window.confirm`: reusable component with `open`/`title`/`message` (React node, amounts in `<strong>`)/`confirmLabel`/`cancelLabel`/`onConfirm`/`onCancel`/`loading` props, `role="dialog"` + `aria-modal="true"`, auto-focus on the confirm button, Escape-key and backdrop-click-to-cancel (both disabled while loading), amber `AlertTriangle` icon, gradient `from-primary-700 to-primary-500` confirm button, gray cancel button, dark-mode aware, `z-[70]` overlay (above the payment modal's `z-[60]`). `ReceivablesPage.jsx` shows it when `amountCents > pendingCents` and only posts the payment after confirmation; the POST logic lives in a `submitPayment()` helper.
✅ Client registration form ("Cadastro de Clientes") — the People screen was renamed (menu label "Clientes", modals "Novo Cliente"/"Editar Cliente") and the form now has, in order: **Nome** (required), **Grupos em comum** (`commonGroups VARCHAR(255)` — de onde o cliente veio), **WhatsApp** (legacy `contact` column renamed to `whatsapp` preserving data; **digits-only storage** masked as `+55 (11) 99999-8888` in the form and table, pre-filled `+55` on create, `type="tel"` + `inputMode="numeric"`; an **inline amber out-of-pattern warning** (AlertTriangle, non-blocking, dark-mode aware) shows when the number has fewer than 10 or more than 15 digits — legacy non-digit values like old e-mails are shown raw with the warning and can still be saved; valid numbers render as a `https://wa.me/{numero}` link in the table). **Instagram** (`instagram VARCHAR(255)`, clickable link with auto `https://` prefix), **Endereço** (`address VARCHAR(500)`, single field), **Grupo VIP** (`isVip Boolean DEFAULT false`, Sim/Não select) and **Cadastrado/Membro doTERRA** (`isDoterraMember Boolean DEFAULT false`, Sim/Não select). New helpers in `frontend/src/utils/whatsapp.js` (`onlyDigits`, `maskWhatsApp`, `isWhatsAppOutOfPattern`, `whatsAppLink`, `isDigitsOnly`). Migration `20260812151032_extend_person_client_fields` was **hand-edited to use `ALTER TABLE ... RENAME COLUMN`** because Prisma's auto-generated migration drops the column and loses data (see lesson #22). Table columns: Nome, Grupos em Comum, WhatsApp (link), Instagram (link), Endereço, VIP (badge Sim/Não), Membro doTERRA (badge Sim/Não), Ações. The Excel "Pessoas" sheet was renamed to **"Clientes"** with the new columns (WhatsApp exported formatted, VIP/Membro as Sim/Não). Nav labels and the onboarding tour step were updated.
✅ Recebíveis list parity — the Controle de Recebíveis table now mirrors the Gestão de Pedidos columns: **Número, Data, Responsável, Valor (R$), Valor Pendente, PV Total, Descrição, Status, Ações** (Tipo Pgto and Rastreio omitted per client request). **Valor Pendente** is computed client-side in integer cents as `max(0, totalValue − Σ payments[].amount)` (clamped to R$ 0,00 on overpayment); **PV Total** = `Σ items[].pv`; **Descrição** truncated with `title` tooltip. No backend changes — `GET /api/orders` already returns `items[]`/`payments[]`. Extracted the shared `formatDateBR` helper into `frontend/src/utils/dates.js` (used by both OrdersPage and ReceivablesPage). 9 new frontend tests (31 → 40 ReceivablesPage).
✅ Payment modal enrichment — the **Registrar Pagamento** modal now shows a **order summary header** (2-column grid: **Número, Data, Responsável, Valor Total, Valor Pendente, Descrição**) always visible above the Pessoa select, and a **per-person items list** (below the pending callout, only when a person is selected) listing each item's **description** (product name), **Valor Cobrado** and **Detalhes** (`—` when null; "Nenhum item registrado para esta pessoa" when empty). The header **Valor Pendente** is the order-wide pending `max(0, totalValue − Σ payments[].amount)` clamped to R$ 0,00 when fully paid or overpaid. Modal widened `max-w-md` → `max-w-lg` with `max-h-[90vh] overflow-y-auto`. **No backend changes** — everything derives client-side from `selectedOrder.items[]`/`payments[]` already returned by `GET /api/orders`. Added `data-testid`s (`payment-modal`, `order-summary-total`, `order-summary-pending`, `order-summary-description`) for robust assertions. 11 new frontend tests (40 → 51 ReceivablesPage).

### Test Results:
- **Backend Tests**: 158 passing (26 People + 44 Orders + 31 Payments + 6 Dashboard + 4 Auth + 16 ProductLoader + 31 Products)
- **Frontend Tests**: 273 passing (23 PeoplePage + 54 OrdersPage + 51 ReceivablesPage + 26 DashboardPage + 32 exportExcel + 10 api + 20 RegisterPage + 10 LoginPage + 6 Header + 11 MobileDrawer + 23 ProductsPage + 7 ThemeContext)
- **Total**: 431 tests passing with zero regressions

Backend note: `vitest.config.js` sets `fileParallelism: false` — test files run serially because they share one database (products.test.js creates active `TESTCRUD` products that would race with the productLoader's deactivation logic under parallelism).



### Key Learnings Documented:
23 critical lessons learned documented in AGENTS.md (see "Lessons Learned / Pitfalls to Avoid") to guide future development:
1. vi.mock hoisting bug in Vitest — arrow-function wrapper solution
2. HTML5 required attribute blocking form submission in jsdom
3. Conditional rendering of dynamic list items
4. dotenv.config() overriding test environment variables
5. Frontend missing "type": "module" in package.json
6. React Router v6 nested Routes causing bugs — Outlet pattern solution
7. Prisma Decimal fields returning strings, not numbers
8. Docker node_modules ownership conflicts
9. Prisma transaction stale data in status re-evaluation
10. formatBRL handling string inputs from Prisma
11. Non-breaking space in BRL currency formatting
12. Floating-point precision in financial calculations — integer cents solution
13. vi.hoisted() for mock variables in ES module tests
14. Backend 403 for expired token — frontend interceptor misses it
15. Timezone-safe date parsing (YYYY-MM-DD strings)
16. CORS + Vite proxy for mobile/network access
17. Docker anonymous volume hides new node_modules after rebuild
18. z-index conflict between modals and mobile navigation
19. Host Prisma client goes stale after schema changes
20. Catalog loader deactivates everything absent from the CSV
21. Vitest runs test files in parallel — shared DB test files must run serially (`fileParallelism: false`)
22. Prisma migrate generates DROP + ADD for column renames — hand-edit to `RENAME COLUMN` or data is lost
23. Never run `prisma migrate dev` against a database with real data — use `migrate deploy` (it never resets)

## Next Steps for Client Requests

When the client requests new functionality:

1. **Create a New Phase Plan**: Add a new section in ROADMAP.md with the new feature request
2. **Define Acceptance Criteria**: Document expected behavior, PT-BR labels, and edge cases
3. **Plan Test Coverage**: Identify which tests need to be written (backend/frontend)
4. **Implement with TDD**: Follow the TDD methodology used in phases 5+
5. **Update Documentation**: Ensure ARCHITECTURE.md, AGENTS.md, and ROADMAP.md reflect changes
6. **Run Full Test Suite**: Verify all 431 tests pass with zero regressions

The codebase is well-structured, documented, and ready to accept new features without breaking existing functionality.

## Lessons Learned / Pitfalls to Avoid

### 1. vi.mock Hoisting Bug (Vitest)
**Problem**: `vi.mock()` factory functions are hoisted to the top of the file by Vitest. They execute BEFORE any `const`/`let` variable declarations. Passing a variable defined at module scope directly to `vi.mock` results in `undefined` at runtime.
```js
// WRONG — mockApi is undefined when vi.mock factory runs
const mockApi = { get: vi.fn(), post: vi.fn() };
vi.mock('../src/services/api', () => ({ default: mockApi }));
```
**Fix**: Use arrow function wrappers that reference the variables lazily:
```js
// CORRECT — arrow functions resolve mockGet etc. at call time, not at hoist time
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));
```

### 2. HTML5 `required` Attribute Blocks Form Submission in jsdom
**Problem**: When a form input has the HTML5 `required` attribute, clicking the submit button in jsdom/React Testing Library does NOT trigger the `onSubmit` handler if the required field is empty. The browser's built-in validation intercepts before React's handler fires. This means custom `setError()` validation inside `onSubmit` never executes.
```js
// WRONG — click on submit button never fires onSubmit if required field is empty
fireEvent.click(screen.getByText('Salvar'));
await waitFor(() => {
  expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument(); // FAILS
});
```
**Fix**: Use `fireEvent.submit(form)` to bypass HTML5 validation and trigger the onSubmit handler directly:
```js
// CORRECT
const form = screen.getByPlaceholderText('Digite o nome').closest('form');
fireEvent.submit(form);
await waitFor(() => {
  expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument(); // PASSES
});
```

### 3. Conditional Rendering of "Remover" Button in Dynamic Item Lists
**Problem**: When a list has only 1 item, the "Remover" (remove) button is intentionally hidden by the component logic (`items.length <= 1`). Tests that add only 1 extra item and then look for "Remover" will fail because the first item still doesn't show the button — only items beyond the first show it when `items.length > 1`.
**Fix**: When testing item removal, add 2+ items first so all items show the "Remover" button, then target a specific one:
```js
fireEvent.click(screen.getByText('Adicionar Item')); // now 2 items
fireEvent.click(screen.getByText('Adicionar Item')); // now 3 items
const removeButtons = screen.getAllByText('Remover');
fireEvent.click(removeButtons[1]); // remove specific item
```

### 4. dotenv.config() Overriding Test Environment Variables
**Problem**: `dotenv.config()` loads `.env` file values which override `process.env` defaults. In Docker, `.env` has `DATABASE_URL=postgresql://admin:admin@db:5432/receivables` (hostname `db`), but tests run on the host machine and need `localhost:5432`. Without a guard, dotenv replaces the test DATABASE_URL with the Docker one.
**Fix**: Skip `dotenv.config()` when `NODE_ENV === 'test'`:
```js
// config.js
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}
```
Test setup file (`backend/tests/setup.js`) must set env vars BEFORE any module imports:
```js
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://admin:admin@localhost:5432/receivables';
process.env.JWT_SECRET = 'test-secret';
process.env.PORT = 4001;
```

### 5. Frontend Missing `"type": "module"` in package.json
**Problem**: When frontend config files (`vite.config.js`, `postcss.config.js`, `vitest.config.js`) use ESM syntax (`export default`), Node.js fails to parse them if `package.json` doesn't declare `"type": "module"`. Error: `SyntaxError: Unexpected token 'export'` or PostCSS config fails to load inside Docker container.
**Fix**: Add `"type": "module"` to `frontend/package.json`. The backend does NOT use this (it's CommonJS).

### 6. React Router v6 — Nested `<Routes>` Inside `<ProtectedRoute>` Causes Routing Bugs
**Problem**: Placing nested `<Routes>` inside a wrapper component (like `<ProtectedRoute>`) causes route matching issues in React Router v6. Child routes fail to render or match incorrectly.
**Fix**: Use the `<Outlet />` pattern — the parent layout component renders `<Outlet />` and the route config nests children under the layout route:
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

### 7. Prisma Decimal Fields Return Strings
**Problem**: Prisma returns `Decimal(10,2)` fields as strings, not numbers. Direct numeric comparisons fail. For example, `order.totalValue` is `"300.00"`, not `300`.
**Fix**: Always use `parseFloat()` when comparing or displaying Decimal values:
```js
const total = parseFloat(order.totalValue); // "300.00" → 300
expect(total).toBe(300);
// In JSX:
<span>R$ {parseFloat(order.totalValue).toFixed(2)}</span>
```

### 8. Docker node_modules Ownership Conflict
**Problem**: When Docker bind-mounts the source directory (`./frontend:/app`), the `node_modules` folder inside the container can be owned by `root`. Running `npm install` on the host then fails with EACCES permission errors.
**Fix**: Remove the host `node_modules` and reinstall as the current user:
```bash
rm -rf frontend/node_modules
cd frontend && npm install
```
The docker-compose volume `- /app/node_modules` creates an anonymous volume that preserves the container's node_modules separately from the host.

### 9. Prisma Transaction — Stale Data in Status Re-evaluation
**Problem**: When creating a payment inside `prisma.$transaction()`, the `order` variable (fetched with `include: { payments }` at the start of the transaction) does NOT include the newly created payment. Using `order.payments` to re-evaluate order status after `tx.payment.create()` results in incorrect status — the new payment is missing from the sum, so status stays `PENDENTE` instead of transitioning to `PARCIAL`.
**Fix**: Manually add the new payment amount to the person's payment sum when re-evaluating status:
```js
// WRONG — order.payments is stale, missing the new payment
const personPaymentSum = order.payments
  .filter(p => p.personId === pid)
  .reduce((sum, p) => sum + parseFloat(p.amount), 0);

// CORRECT — add the new payment amount if it belongs to this person
let personPaymentSum = order.payments
  .filter(p => p.personId === pid)
  .reduce((sum, p) => sum + parseFloat(p.amount), 0);
if (pid === validatedData.personId) {
  personPaymentSum += validatedData.amount;
}
```

### 10. formatBRL Must Handle String Inputs (Prisma Decimal)
**Problem**: Prisma returns `Decimal(10,2)` fields as strings (e.g., `"150.00"`). When `formatBRL(value)` calls `value.toLocaleString(...)`, strings don't have locale-aware number formatting — `"150.00".toLocaleString('pt-BR', {style:'currency'})` just returns `"150.00"` without `R$` prefix or comma separator.
**Fix**: Always parse to number before formatting:
```js
export function formatBRL(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
```

### 11. Non-Breaking Space in BRL Currency Formatting
**Problem**: `toLocaleString('pt-BR', {style:'currency'})` inserts a non-breaking space (`\xa0`, char code 160) between `R$` and the number. Test assertions like `/R\$ 150,00/` fail because the space is `\xa0`, not a regular space.
**Fix**: Use `\s*` regex pattern to match any whitespace including non-breaking spaces:
```js
// WRONG
expect(screen.getByText(/R\$ 150,00/)).toBeInTheDocument();

// CORRECT
expect(screen.getByText(/R\$\s*150,00/)).toBeInTheDocument();
```

### 12. Floating-Point Precision in Financial Calculations
**Problem**: JavaScript IEEE 754 floating-point arithmetic causes precision errors. For example, `1234.56 - 1233 = 1.5599999999999454` instead of `1.56`. This causes overpayment validation to reject valid amounts: `1.56 > 1.5599999999999454` is `true`, so a payment of exactly the pending balance is rejected as overpayment. `Math.round(value * 100) / 100` is also insufficient because `1.005 * 100 = 100.4999...` which rounds to 100 instead of 101.
**Fix**: Use integer cents arithmetic throughout. Convert all monetary values to cents (integers) before comparing, then convert back only for display:
```js
function toCents(value) { return Math.round(parseFloat(value) * 100); }
function fromCents(cents) { return cents / 100; }
// Compare in cents: toCents(1.56) === toCents(1234.56) - toCents(1233)
// 156 === 123456 - 123300 === 156 ✓
```

### 13. vi.hoisted() for Mock Variables in ES Module Tests (Vitest)
**Problem**: When testing a module that calls a mocked dependency at import time (e.g., `axios.create()` in `api.js`), the mock function must be available before the `import` statement executes. ES module `import` is hoisted above any `const` declarations, so even `vi.mock(...)` with arrow-function wrappers fails — the variable is still in the temporal dead zone when the intercepted module evaluates.
```js
// WRONG — mockCreate is in temporal dead zone when api.js imports axios
const mockCreate = vi.fn();
vi.mock('axios', () => ({
  default: { create: (...args) => mockCreate(...args) },
}));
import api from '../src/services/api';  // mockCreate not yet initialized!
```
**Fix**: Use `vi.hoisted()` to make mock variables available before any module imports:
```js
// CORRECT — vi.hoisted() runs before all other code
const { mockCreate, mockRequestUse, mockResponseUse } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRequestUse: vi.fn(),
  mockResponseUse: vi.fn(),
}));

vi.mock('axios', () => ({
  default: { create: (...args) => mockCreate(...args) },
}));

import api from '../src/services/api';  // mockCreate is ready ✓
```
Add a `beforeAll` (or setup in `vi.hoisted`) to configure the mock return value before import:
```js
const { mockRequestUse, mockResponseUse } = vi.hoisted(() => {
  const requestUse = vi.fn();
  const responseUse = vi.fn();

  // Set up axios.create() return value inside hoisted block
  vi.mock('axios', () => ({
    default: {
      create: vi.fn(() => ({
        interceptors: {
          request: { use: requestUse },
          response: { use: responseUse },
        },
      })),
    },
  }));

  return { mockRequestUse: requestUse, mockResponseUse: responseUse };
});
```

### 14. Backend 403 for Expired Token — Frontend Interceptor Misses It

**Problem**: The backend `auth.js` middleware returns **403** (`'Invalid or expired token'`) when `jwt.verify` fails, but the frontend axios response interceptor only checked for **401**. On token expiration, the user was never redirected to login — the 403 error bubbled to individual components, some of which didn't handle it, causing broken UI instead of a clean redirect.
```js
// WRONG — only handles 401, ignores 403 from expired token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {  // 403 ignored!
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```
**Fix**: Treat both 401 and 403 as authentication failures in the interceptor:
```js
// CORRECT — handles both missing token (401) and expired token (403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 15. Timezone-Safe Date Parsing (YYYY-MM-DD strings)
**Problem**: `new Date('2026-05-15')` interprets the string as UTC midnight. In timezones like UTC-3 (Brazil), the local date shifts back to May 14, causing `getDate()` to return 14 instead of 15. This causes backend tests to fail and frontend `formatDateBR()` to display the wrong day.
**Fix**: Parse date strings manually to create local Date objects, and extract date parts directly from the ISO string for display:
```js
// Backend — parse as local date
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Frontend — extract date parts from ISO string (avoids Date object entirely)
const formatDateBR = (dateStr) => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};
```

### 16. CORS + Vite Proxy for Mobile/Network Access
**Problem**: The backend CORS was hardcoded to `origin: 'http://localhost:3000'`, and the frontend API baseURL was hardcoded to `http://localhost:4000/api`. When accessing from another device on the same network (e.g., phone at `http://192.168.x.x:3000`), two failures occurred:
- CORS rejected the request because the origin (`http://192.168.x.x:3000`) didn't match `http://localhost:3000`
- The API call targeted `http://localhost:4000/api` from the phone's browser, which resolves to the phone itself (nothing listening on port 4000)

**Fix**: Two changes were made:

1. **Dynamic CORS origin** (`backend/src/app.js`):
   ```js
   const corsOrigins = process.env.CORS_ORIGIN
     ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
     : true; // true = reflect request origin
   app.use(cors({ origin: corsOrigins, credentials: true }));
   ```
   When `CORS_ORIGIN` is not set, it reflects any origin (safe for development). In production, set `CORS_ORIGIN=https://meusite.com` in `.env`.

2. **Vite proxy for API calls** (`frontend/vite.config.js` + `frontend/src/services/api.js`):
   ```js
   // vite.config.js
   server: {
     proxy: {
       '/api': {
         target: process.env.API_URL || 'http://localhost:4000',
         changeOrigin: true,
       }
     }
   }

   // api.js — use relative URL instead of hardcoded localhost
   const api = axios.create({ baseURL: '/api', ... });
   ```
   The Vite dev server proxies `/api/*` requests to the backend. In Docker, set `API_URL=http://backend:4000` on the frontend service so the proxy reaches the backend container.

**Result**: The browser sends all requests to the same origin (port 3000), eliminating CORS entirely for development. The proxy runs server-side (inside Vite/Docker), so network identity is irrelevant. Added `morgan` HTTP request logging to the backend for easier debugging of future network issues.

### 17. Docker Anonymous Volume Preserves Old node_modules After Image Rebuild

**Problem**: Docker compose uses anonymous volumes (`- /app/node_modules`) to keep container `node_modules` separate from the host bind mount. When `package.json` adds a new dependency (e.g., `jwt-decode`) and `docker compose up --build` rebuilds the image with `npm install`, the **old anonymous volume persists** and hides the new `node_modules` from the image. The new dependency is never installed.

```yaml
# docker-compose.yml — anonymous volume hides new node_modules after rebuild
volumes:
  - ./frontend:/app       # bind mount overrides /app from image
  - /app/node_modules     # anonymous volume keeps OLD node_modules
```

**Fix**: Run `npm install` on every container start, before the application process begins. This updates the anonymous volume with any new dependencies:

```dockerfile
# frontend/Dockerfile — npm install runs before dev server
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0 --port 3000"]
```

And for the backend:

```sh
# backend/entrypoint.sh — npm install runs before migrations
echo "Installing dependencies..."
npm install
```

npm is idempotent and fast when `package.json` hasn't changed (uses local cache), so startup time is minimally affected.

### 18. `z-index` Conflict Between Modals and Mobile Navigation

**Problem**: Modals (`fixed inset-0 z-50`) and the fixed mobile navigation bar (previously the bottom nav `fixed bottom-0 z-50`) both used `z-50`. Since the nav component is rendered after page content in the DOM (inside `AppLayout` in `App.jsx`), it appeared on top of modals regardless of source order. On mobile, the Cancelar/Salvar buttons at the bottom of modal forms were hidden behind the nav bar, making them inaccessible even when scrolling.

```jsx
// WRONG — same z-index, nav wins due to DOM order
// (historically MobileBottomNav.jsx; today MobileDrawer.jsx uses a z-50 drawer + z-40 top bar)
<nav className="fixed bottom-0 left-0 right-0 z-50 ..." />

// PeoplePage.jsx, OrdersPage.jsx, ReceivablesPage.jsx, ProductsPage.jsx
<div className="fixed inset-0 z-50 ..." />  // hidden behind nav
```

**Fix**: Increase the modal z-index to `z-[60]` (higher than the nav's `z-50`) on all modal overlays:

```jsx
// CORRECT — modal stays above nav
<div className="fixed inset-0 z-[60] ..." />
```

This was applied to all modal overlays across:
- `frontend/src/pages/OrdersPage.jsx:250`
- `frontend/src/pages/PeoplePage.jsx:174, 216`
- `frontend/src/pages/ReceivablesPage.jsx:221`
- `frontend/src/pages/ProductsPage.jsx`

Use `z-[60]` consistently for modals and reserve `z-[70]` for toast notifications so there is a clear z-index hierarchy: nav → modals → toasts.

### 19. Host Prisma Client Goes Stale After Schema Changes

**Problem**: Backend tests run from the host machine using the host `node_modules` Prisma client. When new models are added to `schema.prisma` (e.g., `Product`/`ProductPrice`) and the migration is applied inside the Docker container (`prisma migrate dev` regenerates the *container's* client only), the host's generated client is stale. Tests then fail with `TypeError: Cannot read properties of undefined (reading 'findUnique')` because `tx.product` doesn't exist on the old client.
```js
// WRONG — host client was generated before Product/ProductPrice existed
await tx.product.findUnique({ where: { code: row.code } }); // tx.product === undefined
```
**Fix**: Regenerate the Prisma client on the host before running tests after any schema change:
```bash
cd backend && npx prisma generate   # only reads schema.prisma, no DB connection needed
```
The `.env` file is gitignored (the repo ships a versioned `.env.default` template). For host-side scripts the host's `.env` should point to `localhost:5432` (the Docker container exposes port 5432); inside the container use the `db` hostname. To run host-side scripts against the containerized DB, override it with `DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables"`.

### 20. The Catalog Loader Deactivates Everything Absent From the CSV

**Problem**: `loadProductCatalog` intentionally deactivates every active product whose code is NOT present in the loaded CSV (that's how the diff removes products from the list). This means:
- Loading a *partial* CSV (e.g., a 1-product test file, or a subset of the catalog) deactivates ALL other products. I did this twice in development and left the 219-product catalog with `active = false`.
- The backend test suite (which loads TEST-only catalogs) silently deactivated the entire real catalog on every run.

```bash
# DANGEROUS — a 1-product file just disabled the other 218 products
printf 'codigo;produto;tamanho;preco_regular;preco_membros;pv\n60226006;X;1;1;1;1\n' > partial.csv
npm run load:products -- partial.csv   # → 218 products deactivated
```

**Fix**:
1. The CLI prints a loud warning when it deactivates products. Always load the **complete current catalog**, and preview with `--dry-run` first: `npm run load:products -- <csv> --dry-run`.
2. Restore is trivial: re-run the loader with the full CSV (it reactivates previously-inactive products present in the CSV).
3. Integration tests must never let a partial load poison real data. In `backend/tests/productLoader.test.js`:
   - `beforeEach` deactivates all non-TEST products (so deactivation counts are deterministic and only TEST products are asserted).
   - `beforeAll` snapshots `{ id, active }` of every product.
   - `afterAll` restores each real product's `active` flag to the snapshot and deletes leftover TEST products.

### 21. Vitest Runs Test Files in Parallel — Shared DB Test Files Must Run Serially

**Problem**: Vitest by default runs each test file in its own worker concurrently. All backend test files share the same PostgreSQL database. When `products.test.js` (Phase 28) created **active** products with the `TESTCRUD` prefix, the `productLoader` test's deactivation logic raced against them: the loader's `findMany({ where: { active: true } })` picked up a `TESTCRUD` product that was concurrently deleted by the products test's `afterEach`, producing `P2025: Record to update not found`.

```
 FAIL tests/productLoader.test.js > should not persist any change when dryRun is true
 PrismaClientKnownRequestError: P2025 ... Record to update not found
```

**Fix**: Set `fileParallelism: false` in `backend/vitest.config.js` so test files execute serially against the shared database:

```js
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,   // shared DB — avoid cross-file races
  },
});
```

Also keep test data namespaced by file (e.g., `TESTCRUD` for CRUD tests, `TEST0001` for loader tests) so cleanup is deterministic.

### 22. Prisma Migrate Generates DROP + ADD for Column Renames — Hand-Edit to `RENAME COLUMN` or Data Is Lost

**Problem**: When a Prisma field is renamed (e.g., `Person.contact` → `Person.whatsapp`), `prisma migrate dev --create-only` generates a migration that **drops the old column and adds a new one**, silently discarding every existing value:

```sql
-- Auto-generated (Phase 36) — DROPS the column, "All the data in the column will be lost."
ALTER TABLE "Person" DROP COLUMN "contact",
ADD COLUMN "whatsapp" TEXT;
```

This is data loss disguised as a rename. Prisma has no way to know the two fields are the same column, so the only way to preserve data is to hand-edit the generated SQL.

**Fix**: After `--create-only`, rewrite the migration to use a native `RENAME COLUMN` before adding the new columns:

```sql
-- Hand-edited — preserves every existing contact value
ALTER TABLE "Person" RENAME COLUMN "contact" TO "whatsapp";
ALTER TABLE "Person"
  ADD COLUMN "commonGroups" VARCHAR(255),
  ADD COLUMN "instagram" VARCHAR(255),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "isVip" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isDoterraMember" BOOLEAN NOT NULL DEFAULT false;
```

Notes:
- `RENAME COLUMN` keeps the column type — don't re-declare it in the same migration or you'll need a separate `ALTER COLUMN ... TYPE` (with its own data-length validation).
- Always inspect the generated migration SQL and the `Warnings:` header before applying.
- Verify after applying with a quick `SELECT` on the renamed column.

### 23. Never Run `prisma migrate dev` Against a Database With Real Data — Use `migrate deploy`

**Problem**: To create or apply migrations during Phase 36, an agent ran `prisma migrate dev` (a *development* command) from the host against the live dev database, auto-confirming the interactive prompt with `printf 'y\n'`. Prisma detected schema drift and offered to **reset the database** — the auto-confirmed `y` approved it, which **dropped every table and reapplied all migrations from scratch**, destroying all real data (orders, clients, the product catalog, and even the admin user). The tell-tale sign in the output was: instead of applying only the new pending migration, Prisma re-"applied" every migration from `init` onward (a reset re-runs the whole history).

```
$ prisma migrate dev --create-only --name ...
Applying migration `20260530035918_init`        ← re-applying EVERYTHING = reset, not a normal apply
Applying migration `20260614000001_add_user_id_fields`
...
Prisma Migrate created the following migration without applying it ...
```

The migration SQL itself (`RENAME COLUMN` + `ADD COLUMN`) was perfectly safe and data-preserving — the data loss came entirely from the `migrate dev` reset, **not** from the migration.

**Fix**: For any database that holds data you care about (dev with manual entries, staging, production), **only use `migrate deploy`**:

```bash
# SAFE — applies pending migrations, never resets, never prompts
npx prisma migrate deploy
```

`prisma migrate deploy` is designed for CI/production: it only applies migrations not yet recorded in `_prisma_migrations`, never creates migrations, never drops data, and never asks interactive questions. The Docker `entrypoint.sh` already uses `migrate deploy` — so the normal `docker compose up --build` flow is safe.

Reserve `prisma migrate dev` strictly for **brand-new/throwaway** databases (e.g. a fresh local DB or a CI shadow DB). If you must create a migration against a populated DB, generate it with `--create-only` against a **separate shadow database** (or an empty one), hand-edit the SQL, and then apply it with `migrate deploy`. Never pipe `y` into `migrate dev` on a populated database — you may be silently approving a destructive reset.

Recovery note: the idempotent `prisma/seed.js` re-creates the admin user on the next container start; the dōTERRA catalog can be reloaded idempotently with `npm run load:products` (it inserts products absent from the DB). Manually-entered clients/orders, however, are gone unless backed up.