# Receivables Control System - Architecture Documentation

## Overview
This document describes the current state of the project architecture, file organization, and how to run the system.

**🎉 Project Status: PHASE 25 COMPLETE** — All 16 phases + Phases 17-25 completed with 265 automated tests passing (82 backend + 183 frontend). The Receivables Control System is production-ready with full CRUD operations, payment processing, dashboard analytics (including yearly breakdown), Excel export functionality, custom order date support, custom payment date support, user self-registration, automatic 401/403 redirect to login on session expiry, responsive mobile navigation with bottom tab bar, unified design system with brand gradient/glassmorphism, dark mode with manual toggle, lucide-react icons throughout, and logged-in user dropdown menu with Sair option via client-side JWT decoding.

## Technology Stack
- **Backend**: Node.js (Express) with Prisma ORM
- **Frontend**: React with Vite, Tailwind CSS, Recharts, and jwt-decode
- **Database**: PostgreSQL 15
- **Infrastructure**: Docker and Docker Compose

## Ports Configuration
- **Backend API**: http://localhost:4000 (internal; accessed via Vite proxy from frontend)
- **Frontend Application**: http://localhost:3000 (use this from any device on same network; API calls are proxied through Vite)
- **PostgreSQL Database**: localhost:5432 (internal to Docker network)
- **Adminer Database UI**: http://localhost:8080

## Folder Structure
```
oc-receivables-control/
├── docker-compose.yml          # Root Docker Compose orchestration
├── ARCHITECTURE.md             # This file
├── AGENTS.md                   # Original project specs
├── docs/
│   └── ROADMAP.md              # Detailed implementation roadmap
├── backend/
│   ├── Dockerfile              # Backend container definition
│   ├── entrypoint.sh           # Entrypoint script (DB wait & migrations)
│   ├── package.json            # Backend dependencies & scripts
│   ├── .env.default             # Environment variables template (versioned; copy to .env)
│   ├── .env                     # Environment variables (DB, JWT, etc.) — gitignored, user-specific
│   ├── prisma/
│   │   ├── schema.prisma       # Prisma database schema (User, Person, Order, Item, Payment, Product, ProductPrice)
│   │   ├── seed.js             # Admin user seed
│   │   └── migrations/         # SQL migrations (init, userId, add_products)
│   ├── scripts/
│   │   └── loadProducts.js     # CLI: idempotent dōTERRA catalog load (npm run load:products; --date retroactive, --dry-run)
│   └── src/
│       ├── server.js           # Entry point (starts Express server)
│       ├── app.js              # Express app setup (CORS, middleware, routes)
│       ├── config.js           # Environment configuration loader
│       │   └── database.js     # Prisma client singleton
│       ├── middlewares/
│       │   └── auth.js         # JWT authentication middleware
│   ├── controllers/
│   │   ├── authController.js # Auth login + register controllers
│   │   ├── peopleController.js # People CRUD with Zod validation
│   │   ├── ordersController.js # Orders + Items CRUD with Zod validation, custom orderDate, descriptive fields (accountOwner/paymentType/orderNotes)
│ │ ├── paymentsController.js # Payments + balance with transactional status engine, custom paidAt support
│   │   ├── dashboardController.js # Dashboard aggregation (KPIs + person balances + yearly breakdown)
│   │   └── productController.js # Product CRUD (code immutable on update, price history on change, soft-delete; GET list with search/sort/pagination + pageSize=all)
│   ├── utils/
│   │   ├── money.js # toCents, fromCents, formatBRL (integer cents arithmetic)
│   │   ├── csvParser.js # parseProductCsv / parseProductCsvFile (';' delimiter, strings kept for precision)
│   │   └── productLoader.js # loadProductCatalog — idempotent diff loader with price history
│   └── routes/
│       ├── authRoutes.js # Auth route definitions (/api/auth/login, /api/auth/register)
│       ├── peopleRoutes.js # People CRUD routes (/api/people)
│       ├── ordersRoutes.js # Orders + Items + Payments routes (/api/orders, /api/orders/items/:id, /api/orders/:orderId/payments, /api/orders/:orderId/balance)
│       ├── dashboardRoutes.js # Dashboard route (/api/dashboard)
│       └── productRoutes.js # Product CRUD routes (/api/products)
│ ├── vitest.config.js # Vitest config for backend (node environment, serial test files)
│ └── tests/
│ ├── setup.js # Test environment setup (NODE_ENV, DATABASE_URL, JWT_SECRET)
│ ├── people.test.js # 17 People CRUD tests
│   ├── orders.test.js # 42 Orders + Items CRUD tests (incl. product/chargedValue/orderDate/descriptive fields)
│   ├── payments.test.js # 28 Payments & Balance tests (incl. 2 floating-point regression tests + 2 custom paidAt tests)
│   ├── dashboard.test.js # 6 Dashboard yearly breakdown tests
│   ├── auth.test.js # 4 Auth tests
│   ├── productLoader.test.js # 16 CSV parsing + catalog loader (idempotent diff, price history, retroactive date, dry-run) tests
│   └── products.test.js # 31 Product CRUD tests (create/duplicate 409, list+search+sort+pagination incl. pageSize=all, update w/ immutable code + price history, soft-delete)
├── frontend/
│   ├── Dockerfile              # Frontend container definition
│   ├── package.json            # Frontend dependencies & scripts
│   ├── vitest.config.js        # Vitest config for frontend (jsdom, globals)
│   ├── index.html              # HTML template
│   ├── main.jsx                # React entry point (inline theme flash prevention)
│   ├── index.css               # Tailwind CSS directives + brand-gradient CSS variables
│   ├── App.jsx                 # Root React component with AppLayout + Outlet
│   ├── services/
│   │   └── api.js              # Axios client with auth interceptor
│ ├── context/
│ │ ├── AuthContext.jsx     # Auth state (login/logout/register/token, user from JWT decode)
│ │ └── ThemeContext.jsx    # Theme state (dark/light toggle, localStorage persistence)
│ ├── components/
│ │ ├── Header.jsx # Responsive desktop header (hidden on mobile) with gradient, theme toggle (Sun/Moon), NavLink + lucide-react, logged-in user badge
│ │ ├── MobileDrawer.jsx # Mobile-only (md:hidden) hamburger top bar + slide-in drawer with all 5 nav items, Tutorial, theme toggle and Sair
│ │ ├── ProtectedRoute.jsx # Route guard for auth
│ │ └── Toast.jsx # Toast notification provider & component
│ ├── utils/
│ │ ├── money.js # toCents, fromCents, formatBRL (integer cents arithmetic, string-safe)
│ │ └── exportExcel.js # XLSX workbook generation (4 sheets, BRL formatting)
│   ├── pages/
│   │   ├── LoginPage.jsx # Login form (PT-BR) with "Criar uma conta" link and registration success message
│   │   ├── RegisterPage.jsx # Registration form (PT-BR) with validation
│ │ ├── DashboardPage.jsx # Dashboard with KPI widgets, Recharts bar chart, yearly breakdown "Resumo por Ano" table & XLSX export button
│ │ ├── PeoplePage.jsx # People CRUD with modals (PT-BR)
│   │   ├── OrdersPage.jsx # Orders CRUD with dynamic item rows, custom order date, tracking link, account owner, payment type, order notes, summary cards (PT-BR)
│ │   ├── ReceivablesPage.jsx # Payment tracking with status badges & payment modal with custom date (PT-BR)
│ │   └── ProductsPage.jsx # Product CRUD — loads the full catalog once (pageSize=all) and does search (name/code), sort (prices/PV) and status filter 100% client-side; infinite scroll slices the in-memory list (20 at a time); create/edit modals (code locked on edit), status toggle
│ └── tests/
│ ├── setup.js # @testing-library/jest-dom + window.matchMedia mock
│ ├── api.test.js # 10 API interceptor tests (request/response, 401 + 403 redirect, other errors)
│ ├── PeoplePage.test.jsx # 14 PeoplePage tests
│   ├── OrdersPage.test.jsx # 52 OrdersPage tests
│   ├── ReceivablesPage.test.jsx # 27 ReceivablesPage tests (badge rendering, payment modal, validation guards, payment date field, toast feedback, FP regression)
│ ├── Header.test.jsx # 6 Header tests (title, nav links incl. Produtos, Sair button, logout function, username display, hidden when not logged in)
│ ├── MobileDrawer.test.jsx # 11 MobileDrawer tests (title, hamburger open/close, 5 nav items, active highlight, logout, tutorial event, backdrop close, mobile-only)
│ ├── ProductsPage.test.jsx # 23 ProductsPage tests (rendering, table, status badges, count, client-side search/filter/sort with no extra API calls, in-memory infinite scroll, create flow + validation, edit with disabled code, PUT payload, deactivate/activate with confirm)
│ ├── DashboardPage.test.jsx # 26 DashboardPage tests (KPI widgets, chart, yearly breakdown, export button integration, toast feedback)
│ ├── RegisterPage.test.jsx # 18 RegisterPage tests (rendering, validation, success redirect, error handling, loading, navigation)
│ ├── LoginPage.test.jsx # 9 LoginPage tests (rendering, registration link, success message, login form)
│ ├── exportExcel.test.js # 32 exportExcel utility tests (workbook structure, sheet content, BRL formatting, empty data, column widths, FP precision)
│ └── ThemeContext.test.jsx # 7 ThemeContext tests (default theme, toggle, dark class management, localStorage persistence, provider guard)
```

## Docker Services
Defined in `docker-compose.yml` with network `receivables-network`:
- **db**: PostgreSQL 15-alpine
  - Ports: 5432:5432
  - Environment: POSTGRES_USER=admin, POSTGRES_PASSWORD=admin, POSTGRES_DB=receivables
  - Volume: postgres_data (persistent storage)
  - Healthcheck: pg_isready for service readiness
- **backend**: Node.js service
  - Builds from ./backend/Dockerfile
  - Ports: 4000:4000
  - Env file: ./backend/.env
  - Depends on: db (with healthcheck)
  - Volumes: ./backend:/app (live code reload), /app/node_modules (container node_modules)
  - Entrypoint: /app/entrypoint.sh (handles DB wait and migrations)
- **frontend**: Vite React service
  - Builds from ./frontend/Dockerfile
  - Ports: 3000:3000
  - Environment: API_URL=http://backend:4000 (Vite proxy target for /api/* calls)
  - Volumes: ./frontend:/app (live code reload), /app/node_modules
  - CMD runs `npm install` before dev server to ensure anonymous volume gets new deps on rebuild
- **adminer**: Database administration UI
  - Image: adminer
  - Ports: 8080:8080
  - Depends on: db

## Backend Configuration (.env)
The repo ships a versioned template `backend/.env.default`. Each environment must have its own `backend/.env` (gitignored). The `entrypoint.sh` auto-creates `.env` from `.env.default` on first container start if it is missing.

```dotenv
# Database Configuration
# Use "localhost" for a local install (no Docker, e.g. Windows with PostgreSQL).
# Use "db" for the Docker Compose setup.
DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"

# JWT Configuration
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="24h"

# Server Configuration
PORT=4000
NODE_ENV=development

# CORS (optional — if unset, reflects request origin for development)
# CORS_ORIGIN=https://meusite.com
```

### Local install (no Docker — e.g. Windows with PostgreSQL installed natively)
```bash
cd backend
cp .env.default .env          # then edit .env: confirm DATABASE_URL hostname is "localhost"
npm install
npx prisma generate
npx prisma migrate deploy
node prisma/seed.js
npm run dev
```

### Docker install
`docker compose up --build` handles everything (the entrypoint auto-creates `.env` from `.env.default` with the Docker-default `db` hostname if it is missing). To customize, copy `.env.default` → `.env` and edit before the first `up`.

## Frontend Configuration (environment variables)
- `API_URL` — Vite proxy target for `/api` requests (defaults to `http://localhost:4000`). In Docker, set to `http://backend:4000`.

## Available npm Scripts
### Backend (`backend/package.json`)
- `npm run dev` - Start backend with nodemon (development)
- `npm start` - Start backend with node (production)
- `npm test` - Run all backend tests with Vitest
- `npm run test:watch` - Run backend tests in watch mode
- `npm run load:products` - Idempotent diff load of the dōTERRA catalog (default `docs/tabela_produtos_doterra_2026.csv`); custom path via `npm run load:products -- <path>`; `--date YYYY-MM-DD` for retroactive validity; `--dry-run` for safe preview

### Frontend (`frontend/package.json`)
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## How to Run the System
1. Ensure Docker and Docker Compose are installed
2. From the project root:
   ```bash
   docker compose up --build
   ```
3. Services will be available:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000 (health check at /health)
   - Adminer: http://localhost:8080 (use PostgreSQL credentials from .env)
4. To stop: `docker compose down`
5. To rebuild after code changes: `docker compose up --build` or `docker compose up -d --build`

## Current Implementation Status
✅ Docker Compose orchestration with all required services
✅ Backend Express server with CORS and JSON middleware
✅ Basic health check endpoint (`GET /health`)
✅ Authentication route structure configured (`/api/auth/login`)
✅ Authentication middleware implemented (`src/middlewares/auth.js`)
✅ Authentication controller implemented with JWT and bcrypt (`src/controllers/authController.js`)
✅ Auth routes implemented (`src/routes/authRoutes.js`)
✅ People CRUD controller with Zod validation (`src/controllers/peopleController.js`)
✅ People routes implemented (`src/routes/peopleRoutes.js`) at `/api/people`
✅ Orders + Items CRUD controller with Zod validation (`src/controllers/ordersController.js`)
✅ Orders + Items routes implemented (`src/routes/ordersRoutes.js`) at `/api/orders` and `/api/orders/items/:id`
✅ Centralized error handling middleware for Zod validation errors
✅ Frontend React entry point with AppLayout + Outlet pattern
✅ AppLayout with header, navigation links (Dashboard/Pessoas/Pedidos/Recebíveis/Produtos), and logout button
✅ MobileDrawer — mobile-only (md:hidden) hamburger top bar + slide-in drawer with all 5 nav items, Tutorial, theme toggle and Sair (replaces the old bottom-nav bar)
✅ Protected route component blocking unauthenticated access (`src/components/ProtectedRoute.jsx`)
✅ PeoplePage component with table listing, create/edit modals, delete confirmation (PT-BR)
✅ OrdersPage component with table listing, status badges, dynamic multi-row item sub-form, custom order date field (PT-BR)
✅ Environment configuration files
✅ Dockerfiles for both backend and frontend
✅ Volume mounting for live development
✅ Prisma schema with User, Person, Order, Item, Payment entities
✅ Product + ProductPrice entities — global dōTERRA catalog with price history (`validFrom`/`validTo` interval), `pv` as Decimal(10,2), `active` flag
✅ Idempotent diff catalog loader (`src/utils/productLoader.js` + `scripts/loadProducts.js`) — creates new products, syncs metadata, closes/reopens price records on change, deactivates removed products; 219 products loaded from 2026 CSV
✅ Product loader test suite: 16 tests covering CSV parsing, idempotency, price-change history, metadata sync, deactivate/reactivate, new-product insertion, retroactive `validFrom`, and dry-run (tests snapshot/restore the real catalog so the suite never disables real products)
✅ Product CRUD controller + routes (`src/controllers/productController.js`, `src/routes/productRoutes.js`) at `/api/products` — GET list (`?active=true`, `q` partial name/code search, `sortBy` name/code/regularPrice/memberPrice/pv + `sortDir`, `page`/`pageSize` pagination returning `{ data, pagination }`, plus `pageSize=all` to return the full list), GET by id, POST create (409 on duplicate code), PUT update (**code immutable** via update Zod schema; price changes close current `validTo` and open a new price record), DELETE soft-delete (`active = false`)
✅ ProductsPage component that loads the whole catalog once (`/products?pageSize=all`) and applies search (name/code), sort dropdown and active/inactive status filter 100% client-side via `useMemo`; infinite scroll (IntersectionObserver sentinel) slices the in-memory list 20 rows at a time with no extra API calls; create/edit modals (code field disabled on edit with "O código não pode ser alterado"), status badges, and Desativar/Ativar actions (`src/pages/ProductsPage.jsx`)
✅ Product CRUD test suite: 31 backend tests (create/duplicate 409/auth 401-403, list + active filter + search + sort + pagination incl. `pageSize=all`, get by id, update metadata/code immutability/price history, soft-delete) + 23 frontend tests
✅ Database migration completed and tables created
✅ Proper relationships and cascade rules established
✅ Working JWT authentication system with bcrypt password hashing
✅ Admin user seeded in database
✅ Axios client with automatic Bearer token injection from localStorage and 401/403 redirect to `/login` on session expiry (`src/services/api.js`)
✅ Auth context provider managing login, logout, and token validation (`src/context/AuthContext.jsx`)
✅ Tailwind CSS setup with PostCSS and Vite integration
✅ Login page with PT-BR labels and error messages (`src/pages/LoginPage.jsx`)
✅ React Router routing with login and protected routes
✅ Shared money utilities (`src/utils/money.js`) with integer cents arithmetic — toCents, fromCents, formatBRL
✅ Backend refactored to use integer cents for all monetary calculations (paymentsController, dashboardController)
✅ Frontend refactored to use integer cents for validation (ReceivablesPage) and total calculation (OrdersPage)
✅ formatBRL handles both number and string inputs (Prisma Decimal fields return strings)
✅ Floating-point precision bug fixed: exact balance comparison (1234.56-1233=1.56) no longer fails
✅ Payment creation endpoint with transactional consistency (`POST /api/orders/:orderId/payments`)
✅ Balance validation: rejects overpayment (amount > pending) and zero/negative amounts
✅ Automatic order status transitions: PENDENTE → PARCIAL → QUITADO
✅ Per-person balance calculation within Prisma transaction
✅ Balance breakdown endpoint (`GET /api/orders/:orderId/balance`) returning per-person pending amounts
✅ Payment and balance routes protected with JWT authentication middleware
✅ Backend payment tests: 27 tests (incl. 2 floating-point regression tests + 2 custom paidAt tests)
✅ ReceivablesPage component with order listing and visual status badges (`src/pages/ReceivablesPage.jsx`)
✅ Status badges with emoji indicators: 🔴 Pendente, ⚠️ Parcial, ✅ Quitado
✅ Payment modal with person dropdown (populated from balance API), amount input, custom payment date field, notes field
✅ Frontend overpayment validation guard: rejects amount > pending balance
✅ Frontend zero/negative validation: rejects amount <= 0
✅ Toast notification system (`src/components/Toast.jsx`) with success/error types and auto-dismiss
✅ Navigation links: Dashboard, Pessoas, Pedidos, Recebíveis
✅ Backend dashboard controller (`src/controllers/dashboardController.js`) with `getDashboardData` aggregation
✅ Backend `GET /api/dashboard` (JWT-protected) returns: totalPending, totalPaid, currentMonthReceipts, personBalances[], yearlyBreakdown[]
✅ DashboardPage component (`src/pages/DashboardPage.jsx`) with KPI widgets, Recharts bar chart, yearly breakdown "Resumo por Ano" table (with Pendente/Quitado columns per year), and XLSX export button
✅ DashboardPage test suite: 26 tests covering: rendering, KPI widgets (BRL formatting, zero values), chart (data present, empty state), yearly breakdown table (title, headers, year values, BRL formatting, row count, empty state), error/auth handling
✅ XLSX export button ("📥 Exportar para Excel") on DashboardPage — fetches /api/orders, /api/people, /api/dashboard concurrently
✅ Export utility (`frontend/src/utils/exportExcel.js`) — generates 4-sheet .xlsx workbook: Pedidos, Pessoas, Histórico de Pagamentos, Saldo Pendente
✅ BRL monetary cell formatting (#,##0.00) on all currency fields in exported Excel
✅ Browser download of `relatorio-recebiveis.xlsx` triggered by XLSX.writeFile
✅ Export button disabled when no data (all KPIs zero, no personBalances)
✅ Export loading state with "Exportando..." spinner
✅ Toast feedback for export: "Relatório exportado com sucesso!" / "Erro ao exportar relatório."
✅ exportExcel unit test suite: 32 tests covering workbook structure, sheet content (Pedidos, Pessoas, Histórico de Pagamentos, Saldo Pendente), BRL monetary cell formatting, DD/MM/YYYY date formatting, empty data handling, column widths, floating-point precision
✅ DashboardPage export integration tests: 7 tests covering export button rendering, disabled state, enabled state, exportExcel call with fetched data, success/error toast feedback, "Exportando..." loading state

## Completed Phases (32)
- **Phase 20**: ✅ Prisma schema update (`userId` in Person/Order), registration API (`POST /api/auth/register`), and TDD setup. 82 backend tests.
- **Phase 21**: ✅ Backend data isolation (middleware enforcement on all routes, query filtering by `req.user.userId`). `userId` made required with `ON DELETE CASCADE`.
- **Phase 22**: ✅ Frontend registration UI (`RegisterPage.jsx`) with PT-BR form, client-side validation, success redirect, and LoginPage navigation. 18 RegisterPage tests + 9 LoginPage tests. 160 frontend tests, 242 total tests.
- **Phase 23**: ✅ Responsive header with gradient design. Mobile bottom navigation bar with lucide-react icons. 170 frontend tests, 252 total tests.
- **Phase 24**: ✅ Design system unification + dark mode. Tailwind config with `darkMode: 'class'` and `primary` tokens. `ThemeContext.jsx` with localStorage persistence and system preference detection. All emojis replaced with `lucide-react` icons. Border-top accent on all cards. Gradient buttons (`from-primary-700 to-primary-500`). Unified status badges with colored dots. Glassmorphism modals. `dark:` variants everywhere. 180 frontend tests (173 + 7 new ThemeContext tests), 262 total tests.
- **Phase 25**: ✅ Logged-in user badge in header (desktop) and clickable dropdown with Sair option in mobile bottom nav. `jwt-decode` added for client-side JWT payload extraction. Docker `npm install` on container start to ensure anonymous volumes receive new dependencies on rebuild. 183 frontend tests (6 Header + 7 MobileBottomNav), 265 total tests.
- **Phase 26**: ✅ Interactive 8-step onboarding tour with auto-trigger on first login after registration and manual restart via header/mobile nav. 183 frontend tests, 265 total tests.
- **Phase 27**: ✅ Product Catalog (dōTERRA) — global `Product` + `ProductPrice` tables with price history, idempotent diff loader (`npm run load:products`, `--date` retroactive + `--dry-run`), CSV parser, 16 new backend tests, 219 products loaded. 98 backend tests, 281 total tests.
- **Phase 28**: ✅ Product CRUD API (`/api/products`) with immutable code, price-history-preserving updates and soft-delete; ProductsPage UI; mobile bottom nav replaced by a hamburger/drawer menu (`MobileDrawer.jsx`) and Produtos link added to desktop header; onboarding tour updated to 9 steps. 21 new backend tests + 11 MobileDrawer tests + 14 ProductsPage tests. 119 backend tests, 201 frontend tests, 320 total tests.
- **Phase 29**: ✅ Product search & infinite scroll — `GET /api/products` extended with `q` (partial name/code, case-insensitive), `sortBy`/`sortDir` (name/code/regularPrice/memberPrice/pv) and `page`/`pageSize` pagination returning `{ data, pagination }`; ProductsPage gained a search box with icon, sort dropdown, active/inactive status filter, product count and IntersectionObserver infinite scroll (20 per page). 9 new backend tests + 6 new frontend tests. 128 backend tests, 207 frontend tests, 335 total tests.
- **Phase 30**: ✅ Client-side search/sort/filter — `GET /api/products` accepts `pageSize=all` to return the full list; ProductsPage loads the catalog once into browser memory and applies search (name/code), active/inactive status filter and sorting in-memory via `useMemo`, with infinite scroll slicing the in-memory list (no per-filter API calls). 1 new backend test + 3 new frontend tests. 129 backend tests, 210 frontend tests, 339 total tests.
- **Phase 31**: ✅ Order item sub-form — each item links to a catalog product (`productId` FK → `Product`, `ON DELETE SET NULL`) via a filterable `ProductCombobox` that auto-fills read-only member-price and PV snapshots, plus an editable `chargedValue` (renamed from `value`) and free-text `details VARCHAR(500)`. Field order per item: Pessoa → Produto → Valor Membro → Valor Cobrado → PV → Detalhes, with a "Limpar produto" unlink button. `description` became optional (auto-filled from product name). Backend: new `validateProducts` helper (active products only), `itemSchema` extended, payments/dashboard sums read `chargedValue`. Migration `20260811190000_extend_item_fields`. 6 new backend tests + 11 new frontend tests. 135 backend tests, 221 frontend tests, 356 total tests.
- **Phase 32**: ✅ Order descriptive fields — dōTERRA number placeholder + "Ver pedido no site" tracking link (`https://status.ondeestameupedido.com/tracking/{numero}/`), free-text `accountOwner VARCHAR(120)` (dōTERRA ID or name), `PaymentType` enum select (PIX / Boleto / Cartão de Crédito), free-text `orderNotes VARCHAR(500)` with live counter, and client-computed "Soma dos Produtos (Valor Cobrado)" + "Soma dos PV" summary cards above the items. Orders list gained Responsável, Tipo Pgto (badge), PV Total, Descrição (truncated + tooltip) and Rastreio (external link) columns. Backend: `createOrderSchema`/`updateOrderSchema` extended with the three nullable fields; `updateOrder` uses the `!== undefined` spread pattern so explicit `null` clears a field. Migration `20260811193000_add_order_descriptive_fields`. 9 new backend tests + 17 new frontend tests. 144 backend tests, 238 frontend tests, 382 total tests.

## Notes for Developers/Agents
- Backend source is mounted at `/app` inside container for live editing
- Frontend source similarly mounted for hot module replacement
- Node modules are installed within containers (separate from host)
- Environment variables are loaded via `.env` file for backend
- Frontend uses Vite proxy (`/api` → backend) so all requests go to the same origin, eliminating CORS issues. See lesson #16 in AGENTS.md.
- All financial calculations use integer cents via `src/utils/money.js` to avoid IEEE 754 floating-point errors
- Date strings (YYYY-MM-DD) must be parsed as local dates using `parseLocalDate()` (backend) or split-extracted (frontend) to avoid UTC timezone shifts