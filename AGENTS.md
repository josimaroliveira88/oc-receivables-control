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
- Backend tests: 57 tests passing using Vitest + supertest
- `backend/tests/people.test.js`: 14 tests
- `backend/tests/orders.test.js`: 20 tests
- `backend/tests/payments.test.js`: 23 tests
- Frontend tests: 32 tests passing using Vitest + React Testing Library
  - `frontend/tests/PeoplePage.test.jsx`: 14 tests (arrow-function mock pattern to avoid hoisting issues)
  - `frontend/tests/OrdersPage.test.jsx`: 18 tests (arrow-function mock pattern to avoid hoisting issues)
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
- `backend/tests/payments.test.js`: 23 tests covering:
  - POST /payments: partial payment → PARCIAL, full payment → QUITADO, overpayment rejection, zero/negative Zod validation, invalid personId, non-existent order/person, 401/403 auth guards, PENDENTE→PARCIAL→QUITADO transitions, optional notes, two-person scenarios
  - GET /balance: per-person balance breakdown, partial payments, fully paid (pending=0), 404 non-existent order, 401/403 auth guards
  - Transactional consistency: atomic status update within transaction, rollback verification (overpayment does not persist payment, status stays PENDENTE)
- All orderNumbers use dynamic `uniqueOrderNumber()` function to avoid unique constraint conflicts across test runs
- All created persons and orders are tracked in arrays and cleaned up in afterEach
- Total backend tests: 57 (14 people + 20 orders + 23 payments)

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