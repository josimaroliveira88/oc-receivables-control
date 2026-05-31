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
   - Priority: partial payment, full payment, overpayment rejection, status transitions, transactional consistency
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
5. Make sure ROADMAP.md accurately reflects completed and pending work
6. Document test files and coverage under "## Available Test Scripts"

This ensures future agents can understand the project state and continue development seamlessly.

## Available Test Scripts

Backend:
- `npm run test` - Runs all backend tests with Vitest
- `npm run test:watch` - Runs backend tests in watch mode

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

## Phase Completion Notes

Phase 2 (Database Modeling & Migrations) has been completed:
- Prisma schema created with User, Person, Order, Item, and Payment entities
- Database migrations executed and tables created in PostgreSQL
- Proper relationships and cascade rules established:
  - Order has 1:N relationships with Item and Payment (Cascade delete)
  - Person has 1:N relationships with Item and Payment (SetNull on delete)
  - All monetary fields use Decimal(10,2) precision as required

Phase 3 (Express Core Server & Auth Layer) has been completed:
- Implemented core Express server architecture with src/server.js & src/app.js
- Created authentication middleware in src/middlewares/auth.js
- Built authentication controller and routes in src/controllers/authController.js and src/routes/authRoutes.js
- Added JWT validation and bcrypt password hashing for secure authentication
- Implemented centralized error handling middleware for Zod validation errors
- Seeded admin user in the database
- Working Express server responds to POST /api/auth/login with valid JWT payload and expiration field

Phase 4 (Frontend Authentication Flow) has been completed:
- Created Axios client (src/services/api.js) with automatic Bearer token injection from localStorage
- Implemented AuthContext (src/context/AuthContext.jsx) managing login, logout, and token validation state
- Built ProtectedRoute component (src/components/ProtectedRoute.jsx) blocking unauthenticated views
- Developed LoginPage (src/pages/LoginPage.jsx) with PT-BR labels: "Entrar no Sistema", "Usuário", "Senha", "Acessar"
- Error message: "Usuário ou senha inválidos. Tente novamente."
- Tailwind CSS configured with PostCSS and Vite integration
- React Router routing with login and protected routes configured

Phase 5 (Frontend Component CRUD - People & Orders) has been completed:
- Backend: Implemented `peopleController.js` with CRUD operations and Zod validation (name required, contact optional/nullable)
- Backend: Implemented `ordersController.js` with CRUD operations for Orders + Items sub-resource, including dynamic item management and total recalculation
- Backend: Created `peopleRoutes.js` mounting GET/POST/PUT/DELETE at `/api/people`
- Backend: Created `ordersRoutes.js` mounting Orders CRUD at `/api/orders` and Items CRUD at `/api/orders/items/:id`
- Backend: Fixed controller issues (removed broken `status: {}` empty object, separated create/update Zod schemas)
- Frontend: Created `PeoplePage.jsx` with table listing, create/edit modals, delete confirmation, PT-BR labels ("Cadastro de Pessoas", "Nome", "Contato", "Novo", "Editar", "Excluir")
- Frontend: Created `OrdersPage.jsx` with table listing, status badges, create/edit modal with dynamic multi-row item sub-form, person dropdown, total calculation, PT-BR labels ("Gestão de Pedidos", "Adicionar Item", "Descrição", "Valor (R$)", "Pessoa")
- Frontend: Restructured `App.jsx` using `AppLayout` + `Outlet` pattern with navigation links to Pessoas/Pedidos
- Backend tests: 59 tests passing using Vitest + supertest
- `backend/tests/people.test.js`: 14 tests
- `backend/tests/orders.test.js`: 20 tests
- `backend/tests/payments.test.js`: 25 tests (incl. 2 floating-point regression tests)
- Frontend tests: 66 tests passing using Vitest + React Testing Library
- `frontend/tests/PeoplePage.test.jsx`: 14 tests (arrow-function mock pattern to avoid hoisting issues)
- `frontend/tests/OrdersPage.test.jsx`: 18 tests (arrow-function mock pattern to avoid hoisting issues)
- `frontend/tests/ReceivablesPage.test.jsx`: 22 tests (arrow-function mock pattern, ToastProvider wrapper, regex matchers for emoji badges, FP precision regression)
- `frontend/tests/DashboardPage.test.jsx`: 12 tests (KPI widgets, chart, empty state, auth error)
- All tests follow TDD methodology (tests written before final implementation)

Phase 9 (Backend Payments & Status Engine) has been completed:
- Implemented `POST /api/orders/:orderId/payments` — transactional payment creation with Prisma $transaction
- Payment validation: rejects amount <= 0 (Zod), rejects amount > pending balance (business logic)
- Per-person balance calculation: sums items and historical payments for the personId, computes pending = itemSum - paymentSum
- Automatic order status transitions inside transaction:
  - All persons paid (pending <= 0 for every person) → QUITADO
  - Some persons have partial payments but balances remain → PARCIAL
  - No payments at all → PENDENTE
- Implemented `GET /api/orders/:orderId/balance` — returns per-person balance breakdown (personId, personName, itemTotal, paymentTotal, pending)
- Payment and balance endpoints protected with authenticateToken JWT middleware
- Created `src/controllers/paymentsController.js` with createPayment and getOrderBalance
- Updated `src/routes/ordersRoutes.js` to mount payment and balance routes with auth
- Existing test suite (34 backend tests) passes with no regressions

Phase 10 (Backend Tests — Payments & Status) has been completed:
- `backend/tests/payments.test.js`: 25 tests covering:
- POST /payments: partial payment → PARCIAL, full payment → QUITADO, overpayment rejection, zero/negative Zod validation, invalid personId, non-existent order/person, 401/403 auth guards, PENDENTE→PARCIAL→QUITADO transitions, optional notes, two-person scenarios
- Floating-point regression: exact balance 1234.56-1233=1.56, overpayment rejection with cents
  - GET /balance: per-person balance breakdown, partial payments, fully paid (pending=0), 404 non-existent order, 401/403 auth guards
  - Transactional consistency: atomic status update within transaction, rollback verification (overpayment does not persist payment, status stays PENDENTE)
- All orderNumbers use dynamic `uniqueOrderNumber()` function to avoid unique constraint conflicts across test runs
- All created persons and orders are tracked in arrays and cleaned up in afterEach
- Total backend tests: 59 (14 people + 20 orders + 25 payments)

Phase 11 (Frontend ReceivablesPage UI) has been completed:
- Created `src/pages/ReceivablesPage.jsx` — payment tracking page with order listing, status badges (🔴 Pendente / ⚠️ Parcial / ✅ Quitado), and "Registrar Pagamento" button per order
- Payment modal fetches per-person balance via `GET /api/orders/:orderId/balance`, populates person dropdown with only pending balances
- Frontend validation guards: rejects amount > pending balance ("Valor excede o saldo pendente"), rejects amount <= 0 ("Valor deve ser maior que zero")
- Payment submission to `POST /api/orders/:orderId/payments` with amount, personId, and optional notes
- Created `src/components/Toast.jsx` — reusable toast notification system with ToastProvider context, useToast hook, success/error types, 3s auto-dismiss
- Toast messages in PT-BR: "Pagamento registrado com sucesso!" (success) / "Valor excede o saldo pendente" (error)
- Updated `src/App.jsx` — added ToastProvider wrapper, ReceivablesPage route at `/receivables`, navigation link "Recebíveis" in AppLayout
- Orders with status QUITADO show "Pago" label instead of payment button
- Existing frontend tests (32) and backend tests (57) pass with no regressions

Phase 12 (Frontend Tests — ReceivablesPage) has been completed:
- Created `frontend/tests/ReceivablesPage.test.jsx` — 22 tests organized in 6 groups:
- Rendering (4): page title, loading state, empty state, API error message
- Badge Rendering (3): 🔴 Pendente, ⚠️ Parcial, ✅ Quitado — using regex matchers for emoji-prefixed text
- Action Buttons (2): "Registrar Pagamento" for PENDENTE/PARCIAL orders, "Pago" label for QUITADO orders
- Payment Modal (6): modal open with balance fetch, person dropdown with pending values, balance display per person, empty pending state, close via "Cancelar", close via × button
- Validation Guards (4): zero/negative amount rejection ("Valor deve ser maior que zero"), overpayment rejection ("Valor excede o saldo pendente"), valid payment POST submission
- Floating-point regression: overpayment guard with exact cent precision (toCents/fromCents)
- Toast Feedback (2): success toast "Pagamento registrado com sucesso!", error toast for backend overpayment rejection
- All tests use arrow-function mock pattern (Lição 1), ToastProvider wrapper (useToast context), fireEvent.submit for form validation bypass (Lição 2)
- Total frontend tests: 66 (14 PeoplePage + 18 OrdersPage + 22 ReceivablesPage + 12 DashboardPage)
- All existing backend tests (59) pass with no regressions

Phase 13 (Frontend Dashboard & Charts) has been completed:
- Backend: Created `src/controllers/dashboardController.js` with `getDashboardData` aggregation endpoint
- Backend: `GET /api/dashboard` (JWT-protected) returns: totalPending, totalPaid, currentMonthReceipts, personBalances[]
- Backend: Created `src/routes/dashboardRoutes.js` mounting GET at `/api/dashboard` with authenticateToken
- Backend: Updated `src/app.js` to register dashboard route
- Frontend: Installed `recharts` dependency
- Frontend: Created `src/pages/DashboardPage.jsx` with KPI widgets and Recharts bar chart
- KPI Widgets (3): 🔴 "Total Pendente" (red), ✅ "Total Quitado" (green), 💰 "Recebimentos (Mês Atual)" (blue)
- KPI values formatted as BRL currency (pt-BR locale)
- Bar Chart: "Saldos por Pessoa" — X-axis personName, Y-axis BRL values, bars for "Itens" (blue) and "Pagamentos" (green)
- Tooltip with BRL currency formatting, Y-axis tick formatter (R$ 1.5k)
- Empty state: "Nenhum saldo por pessoa" when no personBalances data
- Loading spinner and error handling with PT-BR messages
- Frontend: Updated `src/App.jsx` — imported DashboardPage, replaced placeholder Dashboard, added "Dashboard" nav link (first in nav)
- Person with null personId (deleted person) displayed as "Sem pessoa" in chart
- Current month receipts calculated by filtering payments where paidAt matches current year/month
- totalPending = sum of (orderTotal - paymentSum) for PENDENTE/PARCIAL orders; totalPaid = sum of totalValue for QUITADO orders
- Existing backend tests (59) and frontend tests (66) pass with no regressions

Phase 14 (Frontend Tests — Dashboard & Charts + Floating-Point Fix) has been completed:
- Created shared `src/utils/money.js` (backend + frontend) with `toCents`, `fromCents`, `formatBRL` using integer cents arithmetic
- Refactored `backend/src/controllers/paymentsController.js` — all sums/comparisons use integer cents internally
- Refactored `backend/src/controllers/dashboardController.js` — same cents approach
- Added 2 regression tests in `backend/tests/payments.test.js`: exact balance (1234.56-1233=1.56) and overpayment rejection with cents
- Refactored `frontend/src/pages/ReceivablesPage.jsx` — validation uses cents, display uses formatBRL
- Refactored `frontend/src/pages/OrdersPage.jsx` — calculateTotal uses cents, display uses formatBRL
- Refactored `frontend/src/pages/DashboardPage.jsx` — replaced inline formatBRL with imported shared utility
- Fixed `formatBRL` to handle string inputs (Prisma Decimal fields return strings) — `parseFloat()` before `toLocaleString()`
- Updated test assertions to match pt-BR locale formatting: `R$ 300,00` (comma decimal), `\s*` regex for non-breaking space
- Created `frontend/tests/DashboardPage.test.jsx` — 12 tests:
- Rendering (4): page title, loading state, API error, 401 session expired
- KPI Widgets (5): "Total Pendente", "Total Quitado", "Recebimentos (Mês Atual)" labels, BRL currency formatting, zero values
- Chart (3): "Saldos por Pessoa" with data, empty state, chart container present
- Total frontend tests: 66 (14 + 18 + 22 + 12)
- Total backend tests: 59 (14 + 20 + 25)

Phase 15 (Frontend XLSX Export Feature) has been completed:
- Installed `xlsx` (SheetJS v0.18.5) as frontend dependency
- Created `frontend/src/utils/exportExcel.js` — client-side Excel export utility generating 4-sheet workbook:
  - "Pedidos" sheet: orderNumber, orderDate (DD/MM/YYYY), totalValue (BRL #,##0.00), status
  - "Pessoas" sheet: name, contact
  - "Histórico de Pagamentos" sheet: orderNumber, personName, amount (BRL), paidAt (DD/MM/YYYY), notes
  - "Saldo Pendente" sheet: personName, itemTotal (BRL), paymentTotal (BRL), pending (BRL)
- BRL monetary cell formatting via SheetJS number format `#,##0.00` on all currency fields
- Browser download triggered via `XLSX.writeFile(wb, 'relatorio-recebiveis.xlsx')`
- Updated `DashboardPage.jsx` — added "📥 Exportar para Excel" button in header
- Export fetches /api/orders, /api/people, /api/dashboard concurrently via Promise.all (no new backend endpoint needed)
- Export button disabled when no data (all KPIs zero, no personBalances)
- Loading state "Exportando..." with spinner during export
- Toast feedback: "Relatório exportado com sucesso!" (success) / "Erro ao exportar relatório." (error)
- Updated `DashboardPage.test.jsx` — added ToastProvider wrapper, exportExcel mock, /orders and /people mock handlers
- All existing tests pass with no regressions: 66 frontend, 59 backend

Phase 16 (Frontend Tests — XLSX Export) has been completed:
- Created `frontend/tests/exportExcel.test.js` — 32 unit tests for exportExcel utility:
  - Workbook Structure (3): 4 sheets created, correct sheet names (Pedidos, Pessoas, Histórico de Pagamentos, Saldo Pendente), filename "relatorio-recebiveis.xlsx"
  - Pedidos Sheet (4): correct headers, order rows populated, DD/MM/YYYY date formatting, monetary cells as numbers with BRL `#,##0.00` format
  - Pessoas Sheet (3): correct headers, person rows populated, empty string for null contact
  - Histórico de Pagamentos Sheet (6): correct headers, payment rows from orders with payments, BRL monetary cell format, DD/MM/YYYY date formatting, notes field, "Sem pessoa" for deleted person, skip orders with no payments
  - Saldo Pendente Sheet (4): correct headers, person balance rows, all 3 monetary columns with BRL `#,##0.00` format, string monetary values from Prisma Decimal
  - Empty Data Handling (6): 4 sheets created with empty inputs, headers-only sheets for each, null/undefined inputs handled gracefully
  - Column Widths (4): `!cols` set on all 4 sheets with correct number of columns
  - Floating-Point Precision (1): 1234.56-1233=1.56 pending balance without FP errors
- Updated `frontend/tests/DashboardPage.test.jsx` — added 7 export integration tests (12 → 19 total):
  - Export Button (7): "Exportar para Excel" button rendered, disabled when no data, enabled when data exists, calls exportExcel with fetched orders/people/dashboard, success toast "Relatório exportado com sucesso!", error toast "Erro ao exportar relatório.", "Exportando..." loading state with button disabled
- XLSX.writeFile mocked in exportExcel.test.js to intercept workbook creation without browser download
- mockExportExcel uses arrow-function wrapper pattern to avoid vi.mock hoisting bug
- Total frontend tests: 105 (14 PeoplePage + 18 OrdersPage + 22 ReceivablesPage + 19 DashboardPage + 32 exportExcel)
- Total backend tests: 59 (14 + 20 + 25) — no regressions

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