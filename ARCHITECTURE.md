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
│ ├── people.test.js # 26 People CRUD tests
│   ├── orders.test.js # 44 Orders + Items CRUD tests (incl. product/chargedValue/orderDate/descriptive fields/zero-value gift)
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
│   ├── OrdersPage.test.jsx # 54 OrdersPage tests
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
✅ AppLayout with header, navigation links (Dashboard/Clientes/Pedidos/Recebíveis/Produtos), and logout button
✅ MobileDrawer — mobile-only (md:hidden) hamburger top bar + slide-in drawer with all 5 nav items, Tutorial, theme toggle and Sair (replaces the old bottom-nav bar)
✅ Protected route component blocking unauthenticated access (`src/components/ProtectedRoute.jsx`)
✅ PeoplePage component with table listing, create/edit modals, delete confirmation (PT-BR) — renamed "Cadastro de Clientes" with the full client form: Nome, Grupos em comum, WhatsApp (masked `+55 (11) 99999-8888`, digits-only storage, inline out-of-pattern warning, wa.me link in the table), Instagram (link), Endereço, Grupo VIP (Sim/Não) and Cadastrado/Membro doTERRA (Sim/Não) (`src/pages/PeoplePage.jsx` + `src/utils/whatsapp.js`)
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
✅ Shared date helper (`frontend/src/utils/dates.js`) — `formatDateBR` (PT-BR DD/MM/YYYY), used by OrdersPage and ReceivablesPage
✅ Backend refactored to use integer cents for all monetary calculations (paymentsController, dashboardController)
✅ Frontend refactored to use integer cents for validation (ReceivablesPage) and total calculation (OrdersPage)
✅ formatBRL handles both number and string inputs (Prisma Decimal fields return strings)
✅ Floating-point precision bug fixed: exact balance comparison (1234.56-1233=1.56) no longer fails
✅ Payment creation endpoint with transactional consistency (`POST /api/orders/:orderId/payments`)
✅ Balance validation: accepts zero (R$ 0,00 "Dar baixa" only for gift items with `itemSum === 0`) and overpayments (amount > pending, confirmed in the UI); rejects negative amounts and zero-against-chargeable-items
✅ Automatic order status transitions: PENDENTE → PARCIAL → QUITADO
✅ Per-person balance calculation within Prisma transaction
✅ Balance breakdown endpoint (`GET /api/orders/:orderId/balance`) returning per-person pending amounts
✅ Payment and balance routes protected with JWT authentication middleware
✅ Backend payment tests: 27 tests (incl. 2 floating-point regression tests + 2 custom paidAt tests)
✅ ReceivablesPage component with order listing and visual status badges (`src/pages/ReceivablesPage.jsx`)
✅ Status badges with emoji indicators: 🔴 Pendente, ⚠️ Parcial, ✅ Quitado
✅ Payment modal with person dropdown (populated from balance API), amount input, custom payment date field, notes field
✅ Frontend validation: rejects only negative amounts; rejects zero against a person with chargeable items ("Valor deve ser maior que zero"); shows a custom `ConfirmDialog` (in-app HTML modal) when the amount exceeds the pending balance (overpayment) — the payment is posted only after the user confirms
✅ Frontend "Dar baixa" flow: zero-item persons (itemTotal === 0) appear as "Nada a receber" and are settled with a R$ 0,00 payment (submit button reads "Dar baixa"); fully-paid persons (itemTotal > 0 but pending = 0) require a positive amount
✅ Toast notification system (`src/components/Toast.jsx`) with success/error types and auto-dismiss
✅ Navigation links: Dashboard, Clientes, Pedidos, Recebíveis
✅ Backend dashboard controller (`src/controllers/dashboardController.js`) with `getDashboardData` aggregation
✅ Backend `GET /api/dashboard` (JWT-protected) returns: totalPending, totalPaid, currentMonthReceipts, personBalances[], yearlyBreakdown[]
✅ DashboardPage component (`src/pages/DashboardPage.jsx`) with KPI widgets, Recharts bar chart, yearly breakdown "Resumo por Ano" table (with Pendente/Quitado columns per year), and XLSX export button
✅ DashboardPage test suite: 26 tests covering: rendering, KPI widgets (BRL formatting, zero values), chart (data present, empty state), yearly breakdown table (title, headers, year values, BRL formatting, row count, empty state), error/auth handling
✅ XLSX export button ("📥 Exportar para Excel") on DashboardPage — fetches /api/orders, /api/people, /api/dashboard concurrently
✅ Export utility (`frontend/src/utils/exportExcel.js`) — generates 4-sheet .xlsx workbook: Pedidos, Clientes, Histórico de Pagamentos, Saldo Pendente
✅ BRL monetary cell formatting (#,##0.00) on all currency fields in exported Excel
✅ Browser download of `relatorio-recebiveis.xlsx` triggered by XLSX.writeFile
✅ Export button disabled when no data (all KPIs zero, no personBalances)
✅ Export loading state with "Exportando..." spinner
✅ Toast feedback for export: "Relatório exportado com sucesso!" / "Erro ao exportar relatório."
✅ exportExcel unit test suite: 32 tests covering workbook structure, sheet content (Pedidos, Clientes, Histórico de Pagamentos, Saldo Pendente), BRL monetary cell formatting, DD/MM/YYYY date formatting, empty data handling, column widths, floating-point precision
✅ DashboardPage export integration tests: 7 tests covering export button rendering, disabled state, enabled state, exportExcel call with fetched data, success/error toast feedback, "Exportando..." loading state

## Completed Phases (35)
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
- **Phase 31**: ✅ Order item sub-form — each item links to a catalog product (`productId` FK → `Product`, `ON DELETE SET NULL`) via a filterable `ProductCombobox` that auto-fills read-only member-price and PV snapshots, plus an editable `chargedValue` (renamed from `value`) and free-text `details VARCHAR(500)`. Field order per item: Pessoa → Produto → Valor Membro → Valor Cobrado → PV → Detalhes, with a "Limpar produto" unlink button. `description` became optional (auto-filled from product name). Backend: new `validateProducts` helper (active products only), `itemSchema` extended, payments/dashboard sums read `chargedValue`. Migration `20260811190000_extend_item_fields`. `chargedValue` accepts zero (gift/brinde) and the frontend treats an empty field as 0; backend Zod uses `min(0).default(0)`. 6 new backend tests + 11 new frontend tests. 135 backend tests, 221 frontend tests, 356 total tests.
- **Phase 32**: ✅ Order descriptive fields — dōTERRA number placeholder + "Ver pedido no site" tracking link (`https://status.ondeestameupedido.com/tracking/22747/{numero}/`), free-text `accountOwner VARCHAR(120)` (dōTERRA ID or name), `PaymentType` enum select (PIX / Boleto / Cartão de Crédito), free-text `orderNotes VARCHAR(500)` with live counter, and client-computed "Soma dos Produtos (Valor Cobrado)" + "Soma dos PV" summary cards above the items. Orders list gained Responsável, Tipo Pgto (badge), PV Total, Descrição (truncated + tooltip) and Rastreio (external link) columns. Backend: `createOrderSchema`/`updateOrderSchema` extended with the three nullable fields; `updateOrder` uses the `!== undefined` spread pattern so explicit `null` clears a field. Migration `20260811193000_add_order_descriptive_fields`. 9 new backend tests + 17 new frontend tests. 144 backend tests, 238 frontend tests, 382 total tests.
- **Phase 33**: ✅ Zero/gift `chargedValue` — the Valor Cobrado field now accepts zero (gift/brinde items) and the frontend treats an **empty** field as 0 (no longer required to type 0). Negative values are still rejected. Backend: `itemSchema.chargedValue` changed from `positive()` to `min(0).default(0)` (missing field defaults to 0 — robust for direct API consumers). Frontend: `itemPayload` converts empty/null to 0; create/update validations reject only negatives (`< 0`); Valor Cobrado input keeps `min="0"` and placeholder `0.00`. 2 new backend tests + 2 new/updated frontend tests. 146 backend tests, 240 frontend tests, 386 total tests.
- **Phase 34**: ✅ Receivables adjustments — the "Registrar Pagamento" modal now (a) lists persons with R$ 0,00 item totals as "Nada a receber" and lets the user settle them with a **"Dar baixa"** action that posts a R$ 0,00 payment, and (b) accepts **overpayments**: backend `paymentSchema.amount` changed from `positive()` to `nonnegative()` and the `amount > pending` ("Amount exceeds pending balance") rejection was removed; the frontend validates only negatives and asks for `window.confirm` confirmation when the amount exceeds the pending balance. **Refined zero-amount guard**: a R$ 0,00 payment is only accepted when the person's `itemSum === 0` (gift items) — for a person with chargeable items (`itemSumCents > 0`), zero is rejected by both backend (`'Amount must be greater than zero for a person with chargeable items'`, 400) and frontend ('Valor deve ser maior que zero'). The "Dar baixa" UI is driven by `itemTotal === 0` (not `pending === 0`), so fully-paid persons (`itemTotal > 0`, `pending = 0`) require a positive amount (with overpay confirm still firing). Order status keeps PENDENTE → PARCIAL → QUITADO; overpaid persons report `pending = 0` (clamped) with `paymentTotal` showing the real received amount. 3 new backend tests + 3 new frontend tests. 149 backend tests, 243 frontend tests, 392 total tests.
- **Phase 35**: ✅ Custom overpayment confirmation — a new reusable `frontend/src/components/ConfirmDialog.jsx` replaces the browser-native `window.confirm` gate on the Recebíveis screen. It renders an in-app HTML modal styled like the rest of the app: overlay `fixed inset-0 z-[70]` with `bg-black/50` (above the payment modal's `z-[60]`, same tier as the onboarding tour), centered `bg-white dark:bg-gray-800 rounded-xl shadow-2xl` card, amber `AlertTriangle` icon, gradient `from-primary-700 to-primary-500` confirm button and gray cancel button. Props: `open`, `title`, `message` (React node so amounts are wrapped in `<strong>`), `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `loading`; `role="dialog"` + `aria-modal="true"`, auto-focus on confirm, Escape/backdrop-click to cancel (disabled while loading). `ReceivablesPage.jsx` extracted the payment POST into a `submitPayment()` helper and now sets `showOverpayConfirm = true` when `amountCents > pendingCents` (title "Confirmar recebimento", message "Valor de **R$ X** é maior que o saldo pendente (**R$ Y**). Deseja mesmo confirmar este recebimento?"); `onConfirm` closes the dialog and posts, `onCancel` only closes it. Tests reworked to interact with the dialog via `findByRole('dialog')` + `within()`, with a new boundary test proving no dialog appears when the amount equals the pending balance. 1 new frontend test. 149 backend tests, 244 frontend tests, 393 total tests.
- **Phase 36**: ✅ Client registration — the Pessoas screen was renamed **"Cadastro de Clientes"** (menu label "Clientes", modals "Novo Cliente"/"Editar Cliente") and the person form now has, in order: **Nome** (required), **Grupos em comum** (`commonGroups VARCHAR(255)` — de onde o cliente veio: grupo de WhatsApp, vizinho, família...), **WhatsApp** (legacy `contact` column renamed to `whatsapp` preserving data; digits-only storage with phone mask `+55 (11) 99999-8888` in the form and table, pre-filled `+55` on create; inline amber out-of-pattern warning — non-blocking, no native alerts; the table renders a `https://wa.me/{numero}` link that opens WhatsApp), **Instagram** (`instagram VARCHAR(255)`, clickable link in the table with auto `https://` prefix), **Endereço** (`address VARCHAR(500)`, single field), **Grupo VIP** (`isVip Boolean DEFAULT false`, Sim/Não select) and **Cadastrado/Membro doTERRA** (`isDoterraMember Boolean DEFAULT false`, Sim/Não select). Table columns: Nome, Grupos em Comum, WhatsApp (link), Instagram (link), Endereço, VIP (badge), Membro doTERRA (badge), Ações. Backend Zod schema extended (`whatsapp/commonGroups/instagram` ≤255 nullable, `address` ≤500 nullable, `isVip/isDoterraMember` booleans); migration `20260812151032_extend_person_client_fields` hand-edited to use `ALTER TABLE ... RENAME COLUMN` (Prisma's default would DROP+ADD and lose legacy data). Excel Pessoas sheet renamed to **Clientes** with the new columns (WhatsApp exported formatted, VIP/Membro as Sim/Não). Nav labels and onboarding tour step updated. 9 new backend tests + 9 new frontend tests. **158 backend tests, 253 frontend tests, 411 total tests.**
- **Phase 37**: ✅ Recebíveis list parity — the Controle de Recebíveis table now mirrors the Gestão de Pedidos columns: **Número, Data, Responsável, Valor (R$), Valor Pendente, PV Total, Descrição, Status, Ações** (Tipo Pgto and Rastreio omitted per client request). **Valor Pendente** is computed client-side in integer cents as `max(0, totalValue − Σ payments[].amount)` (clamped to R$ 0,00 on overpayment); **PV Total** = `Σ items[].pv`; **Descrição** truncated with `title` tooltip. No backend changes — `GET /api/orders` already returns `items[]`/`payments[]`. Extracted the shared `formatDateBR` helper into `frontend/src/utils/dates.js` (used by both OrdersPage and ReceivablesPage). 9 new frontend tests (31 → 40 ReceivablesPage). **158 backend tests, 262 frontend tests, 420 total tests.**
- **Phase 38**: ✅ Payment modal enrichment — the **Registrar Pagamento** modal now shows an always-visible **order summary header** (2-column grid: **Número, Data, Responsável, Valor Total, Valor Pendente, Descrição**) above the Pessoa select, plus a **per-person items list** (below the pending callout, when a person is selected) with each item's **description** (product name), **Valor Cobrado** and **Detalhes** (`—` when null). The header **Valor Pendente** is the order-wide `max(0, totalValue − Σ payments[].amount)` clamped to R$ 0,00 when fully paid or overpaid. Modal widened `max-w-md` → `max-w-lg` with `max-h-[90vh] overflow-y-auto`. **No backend changes** — everything derives client-side from `selectedOrder.items[]`/`payments[]` returned by `GET /api/orders`. Added `data-testid`s (`payment-modal`, `order-summary-total`, `order-summary-pending`, `order-summary-description`) for robust assertions. 11 new frontend tests (40 → 51 ReceivablesPage). **158 backend tests, 273 frontend tests, 431 total tests.**

## Notes for Developers/Agents
- Backend source is mounted at `/app` inside container for live editing
- Frontend source similarly mounted for hot module replacement
- Node modules are installed within containers (separate from host)
- Environment variables are loaded via `.env` file for backend
- Frontend uses Vite proxy (`/api` → backend) so all requests go to the same origin, eliminating CORS issues. See lesson #16 in AGENTS.md.
- All financial calculations use integer cents via `src/utils/money.js` to avoid IEEE 754 floating-point errors
- Date strings (YYYY-MM-DD) must be parsed as local dates using `parseLocalDate()` (backend) or split-extracted (frontend) to avoid UTC timezone shifts