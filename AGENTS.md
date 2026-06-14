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

## Project Status

🎉 **All MVP phases (1-16) + Phases 17-23 have been COMPLETED.**

The Receivables Control System is now fully functional with user self-registration, complete backend data isolation, and responsive mobile navigation. Phase 23 added a responsive header with gradient design and a fixed bottom navigation bar with icons on mobile.

### Completed Features:
✅ Multi-container Docker environment (backend, frontend, database, admin UI)
✅ PostgreSQL relational database with Prisma ORM
✅ Express.js backend with JWT authentication
✅ React frontend with Vite and Tailwind CSS
✅ People management (CRUD)
✅ Orders management with dynamic item sub-forms and custom order date
✅ Payment processing with automatic order status transitions (PENDENTE → PARCIAL → QUITADO) and custom payment date
✅ Receivables tracking dashboard with per-person balance breakdown
✅ Analytics dashboard with KPI widgets, Recharts visualizations, and yearly breakdown (Pendente/Quitado por ano)
✅ Excel export functionality (4-sheet workbook with BRL formatting)
✅ Comprehensive test coverage (160 frontend tests + 82 backend tests)
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
✅ Mobile bottom navigation bar with lucide-react icons (Dashboard, Pessoas, Pedidos, Recebíveis, Sair)
✅ Desktop horizontal navigation with `<NavLink>` active state highlighting

### Test Results:
- **Backend Tests**: 82 passing (17 People + 27 Orders + 28 Payments + 6 Dashboard + 4 Auth)
- **Frontend Tests**: 170 passing (14 PeoplePage + 24 OrdersPage + 27 ReceivablesPage + 26 DashboardPage + 32 exportExcel + 10 api + 18 RegisterPage + 9 LoginPage + 4 Header + 6 MobileBottomNav)
- **Total**: 252 tests passing with zero regressions

### Key Learnings Documented:
16 critical lessons learned documented in AGENTS.md (see "Lessons Learned / Pitfalls to Avoid") to guide future development:
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

## Next Steps for Client Requests

When the client requests new functionality:

1. **Create a New Phase Plan**: Add a new section in ROADMAP.md with the new feature request
2. **Define Acceptance Criteria**: Document expected behavior, PT-BR labels, and edge cases
3. **Plan Test Coverage**: Identify which tests need to be written (backend/frontend)
4. **Implement with TDD**: Follow the TDD methodology used in phases 5+
5. **Update Documentation**: Ensure ARCHITECTURE.md, AGENTS.md, and ROADMAP.md reflect changes
6. **Run Full Test Suite**: Verify all 200+ tests pass with zero regressions

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