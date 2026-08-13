🚀 PHASE 1: Infrastructure & Environment Setup
Status: ✅ COMPLETED

Context: Setting up a local multi-container development Docker network for a financial MVP[cite: 27, 28].
Stack: Node.js (Express), React (Vite/Tailwind), PostgreSQL 15, Adminer[cite: 28, 29, 31].

Task:
Generate the orchestration structure for the project. Provide:
1. A root `docker-compose.yml` file configuring[cite: 29]:
- `db`: postgres:15-alpine, persistent volume, port 5432[cite: 29, 95].
- `backend`: Node-based microservice, environment file reference, port 4000[cite: 29, 96].
- `frontend`: Vite React environment node container, port 3000[cite: 29, 96].
- `adminer`: lightweight database viewer, port 8080[cite: 29, 96].
2. A generic `backend/.env` template with standard local DB credentials[cite: 29, 95].
3. Minimal `package.json` configurations for both backend and frontend to allow starting the app with standard local dev tasks (`npm run dev`)[cite: 29, 95].

Deliverable: Provided the required Dockerfiles and compose orchestration so `docker compose up --build` starts both projects, and the frontend/backend are reachable from the browser on the configured ports with at least a loading response.

---

🗃️ PHASE 2: Database Modeling & Migrations
Status: ✅ COMPLETED

Context: Phase 1 infrastructure is configured. Now building the relational schema via Prisma[cite: 31, 99].
Stack: Prisma ORM, PostgreSQL[cite: 28, 31].

Task:
Generated the schema structure. Wrote `backend/prisma/schema.prisma` mapping out these entities[cite: 32, 100]:
- User (id, username, password, timestamps) [cite: 35, 103]
- Person (id, name, contact, timestamps) [cite: 35, 103]
- Order (id, orderNumber, totalValue [Decimal 10,2], orderDate, status [PENDENTE, PARCIAL, QUITADO]) [cite: 36, 104]
- Item (id, description, value [Decimal 10,2], orderId, personId) [cite: 37, 105]
- Payment (id, orderId, personId, amount [Decimal 10,2], paidAt, notes) [cite: 37, 38, 105, 106]

Applied specific relational hooks:
- Order has a 1:N relationship with Item and Payment[cite: 32, 39, 100].
- Person has a 1:N relationship with Item and Payment[cite: 32, 39, 100].
- Cascades: Deleting an Order removes its items/payments[cite: 105, 107]. Deleting a Person preserves the data with SetNull[cite: 105, 107].
Provided the command block to trigger the initial database migration[cite: 33, 101].

Deliverable: Complete `backend/prisma/schema.prisma` plus the migration command that resulted in PostgreSQL tables for User, Person, Order, Item, and Payment with the defined relations and cascade behavior.

---

🔐 PHASE 3: Express Core Server & Auth Layer
Status: ✅ COMPLETED

Context: The Database migration was completed. We need an application endpoint entrypoint with security context[cite: 41, 107].
Stack: Express, JWT, Bcrypt, Zod[cite: 28, 40].

Task:
Implement the core API backend architecture. Generate the following application assets:
1. `src/server.js` & `src/app.js`: Express application instantiation including CORS policies for port 3000 and centralized error validation middleware[cite: 44, 45, 114, 115].
2. `src/middlewares/auth.js`: Token lookup processing incoming `Authorization: Bearer <token>` HTTP headers[cite: 44, 46, 113, 114].
3. `src/controllers/authController.js` & `src/routes/authRoutes.js`: Expose a `POST /api/auth/login` endpoint[cite: 44, 45, 111, 113]. Validate arguments with Zod[cite: 110]. Match against a standard system profile hashed using bcrypt[cite: 42, 111]. Return `{ token, expiresIn: "24h" }`[cite: 43, 112].

Deliverable: A working Express server that can start successfully and respond to `POST /api/auth/login` with a valid JWT payload and expiration field.

---

💻 PHASE 4: Frontend Authentication Flow
Status: ✅ COMPLETED

Context: The Backend API auth structure is ready. Now setting up the frontend application shell[cite: 50, 119].
Stack: React, Tailwind CSS, Axios, React Router[cite: 28, 50].

Task:
Develop the frontend entrypoint system. Generate:
1. `src/services/api.js`: Axios client configuration pointing to port 4000[cite: 51, 120, 123]. Add an automatic request interceptor injecting the active bearer token from localStorage into headers[cite: 51, 52, 122].
2. `src/context/AuthContext.jsx`: State wrapper managing login, logout, and token validation status[cite: 51, 120, 122].
3. `src/components/ProtectedRoute.jsx`: Routing component blocking unauthenticated views[cite: 51, 120, 122].
4. `src/pages/LoginPage.jsx`: Centered responsive login panel styled with Tailwind CSS[cite: 50, 120, 123].
- PT-BR Text Layout labels: "Entrar no Sistema", "Usuário", "Senha", "Acessar"[cite: 51, 120].
- Error notification string: "Usuário ou senha inválidos. Tente novamente."[cite: 51, 120, 121].

Deliverable: A frontend login experience where the user can see the login screen, submit credentials, and transition to protected routes only after successful authentication.

---

📋 PHASE 5: Backend People & Orders CRUD
Status: ✅ COMPLETED

Context: Auth framework is operational. Need backend API endpoints for people and orders data management.
Stack: Node.js, Express, Prisma ORM, Zod[cite: 28, 53].

Task:
Build backend CRUD API endpoints. Create:
1. `src/controllers/peopleController.js`: People CRUD with Zod validation (name required, contact optional/nullable)
2. `src/controllers/ordersController.js`: Orders + Items CRUD with `createOrderSchema` and `updateOrderSchema`; includes addItemToOrder, updateItem, deleteItem with order total recalculation
3. `src/routes/peopleRoutes.js`: GET/POST/PUT/DELETE /api/people
4. `src/routes/ordersRoutes.js`: GET/POST/PUT/DELETE /api/orders + POST /:id/items + PUT/DELETE /items/:id
5. Centralized error handling middleware for Zod validation errors

Deliverable: ✅ Functional people and orders CRUD API endpoints with Zod validation. All endpoints respond correctly to HTTP requests with proper status codes.

---

🧪 PHASE 6: Backend Tests — People & Orders
Status: ✅ COMPLETED

Context: Backend People & Orders CRUD is implemented. Need automated test coverage.
Stack: Vitest, supertest[cite: 28, 53].

Task:
Write backend integration tests for People and Orders CRUD:
1. `backend/tests/people.test.js`: 14 tests for CRUD, Zod validation, missing fields
2. `backend/tests/orders.test.js`: 23 tests for Orders + Items CRUD, status transitions, custom orderDate

Deliverable: ✅ 34 backend tests passing. All People and Orders API endpoints covered with automated tests.

---

💻 PHASE 7: Frontend People & Orders Pages
Status: ✅ COMPLETED

Context: Backend CRUD is ready and tested. Need UI panels to input data resources.
Stack: React, Tailwind CSS, Axios[cite: 28, 53].

Task:
Build management pages targeting data generation. Create:
1. `src/pages/PeoplePage.jsx`: Renders people listing inside a grid layout table and handles creation/modification modals[cite: 53, 55, 125, 129]. Implemented with create/edit modals, delete confirmation, PT-BR labels.
2. `src/pages/OrdersPage.jsx`: Order setup module featuring a dynamic, multi-row sub-form array allowing real-time insertion/removal of multiple line items[cite: 55, 126, 129]. Each line item captures description, cost value, and person dropdown. Implemented with dynamic item rows, total calculation, status badges.
- Interface details in Portuguese (Brazil): "Cadastro de Pessoas", "Gestão de Pedidos", "Nome", "Valor (R$)", "Adicionar Item"[cite: 55, 129].

Deliverable: ✅ Functional people and orders CRUD pages. Users can create/edit records through PT-BR interfaces with modals and dynamic item rows.

---

🧪 PHASE 8: Frontend Tests — People & Orders
Status: ✅ COMPLETED

Context: Frontend People & Orders pages are implemented. Need automated test coverage.
Stack: Vitest, React Testing Library[cite: 28, 53].

Task:
Write frontend tests for People and Orders pages:
1. `frontend/tests/PeoplePage.test.jsx`: 14 tests for rendering, modals, CRUD operations
2. `frontend/tests/OrdersPage.test.jsx`: 24 tests for rendering, dynamic items, person dropdown, validation, orderDate

Deliverable: ✅ 32 frontend tests passing. PeoplePage and OrdersPage fully covered with automated tests (mocking API calls with vi.mock).

---

💰 PHASE 9: Backend Payments & Status Engine
Status: ✅ COMPLETED

Context: Master UI pages can create rows. We now require core financial calculations for partial payment entrypoints[cite: 58, 131, 136].
Stack: Node.js, Prisma ORM, Zod[cite: 28, 62, 136].

Task:
Build the calculation ledger layer. Implement `POST /api/orders/:orderId/payments`[cite: 58, 132].
The code must execute within a standard database transaction block[cite: 60, 135]:
1. Sum total items cost linked to the specific order for the incoming `personId`[cite: 59, 137].
2. Sum all captured historical payments for that same order/person[cite: 59, 137].
3. Evaluate remaining balance liability: `pending = itemSum - paymentSum`[cite: 59, 137].
4. Validate input: reject if payload `amount <= 0` or `amount > pending`[cite: 62, 133, 137].
5. Write the payment log row[cite: 62, 133].
6. Re-evaluate overall order health status: If all buyers owe 0, transition Order status to `QUITADO`[cite: 60, 62, 134, 137]. If some balances are open but partial cash was logged, switch to `PARCIAL`[cite: 60, 62, 134, 137].
7. Return updated transactional payment models back to client[cite: 60, 135].
8. Add `GET /api/orders/:orderId/balance` endpoint to retrieve per-person balance breakdown.

Deliverable: A backend payment endpoint that persists valid payments, enforces balance validation, and updates order status to `PARCIAL` or `QUITADO` as appropriate. Balance endpoint returns per-person pending amounts.

---

🧪 PHASE 10: Backend Tests — Payments & Status
Status: ✅ COMPLETED

Context: Backend payment engine is implemented. Need automated test coverage for financial logic.
Stack: Vitest, supertest, Prisma[cite: 28, 62, 136].

Task:
Write backend tests for payment processing and status transitions:
1. Unit tests for payment service: partial payment, full payment, overpayment rejection (amount > pending), zero/negative amount rejection, status transitions (PENDENTE → PARCIAL → QUITADO), transactional consistency on rollback.
2. Integration tests for the endpoint: valid payment returns 201 with payment data, overpayment returns 400, unauthenticated request returns 401, non-existent order returns 404.
3. Tests for balance endpoint: correct per-person balance calculation, returns 0 for fully paid, returns 404 for non-existent order.

Deliverable: ✅ 23 backend payment tests passing. Coverage includes partial payment, full payment (QUITADO), overpayment rejection, zero/negative amount Zod validation, invalid personId, non-existent order/person, auth guards (401/403), status transitions (PENDENTE→PARCIAL→QUITADO), optional notes, two-person scenarios, balance breakdown, and transactional consistency with rollback verification. Total backend tests: 57 (14 people + 20 orders + 23 payments).

---

📊 PHASE 11: Frontend ReceivablesPage UI
Status: ✅ COMPLETED

Context: Payment backend is ready and tested. Need tracking layout screens[cite: 65, 138, 144].
Stack: React, Tailwind CSS, Axios[cite: 28, 70].

Task:
Implement the tracking panel `src/pages/ReceivablesPage.jsx`[cite: 68, 145]. Provide a UI layout showing financial statuses using visual badge elements[cite: 66, 142, 145]:
- Green Badge: "✅ Quitado" [cite: 66, 145]
- Yellow Badge: "⚠️ Parcial" [cite: 66, 145]
- Red Badge: "🔴 Pendente" [cite: 66, 145]
Create a processing payment modal containing validation guards: prevent submit actions if input value fields bypass the user's outstanding balance ceiling[cite: 68, 141, 145]. Render a standard toast prompt message in Brazilian Portuguese ("Pagamento registrado com sucesso!" / "Valor excede o saldo pendente")[cite: 145].

Deliverable: ✅ A payment tracking UI that displays status badges, validates overpayment at the form layer, and confirms success with toast feedback. ReceivablesPage shows orders with 🔴 Pendente / ⚠️ Parcial / ✅ Quitado badges. Payment modal fetches balance per person via GET /api/orders/:orderId/balance, enforces frontend validation (amount > pending → "Valor excede o saldo pendente", amount <= 0 → "Valor deve ser maior que zero"), and submits to POST /api/orders/:orderId/payments. Toast notification system (Toast.jsx with ToastProvider + useToast hook) renders success/error messages in PT-BR with 3s auto-dismiss. Navigation link "Recebíveis" added to AppLayout.

---

🧪 PHASE 12: Frontend Tests — ReceivablesPage
Status: ✅ COMPLETED

Context: Frontend ReceivablesPage is implemented. Need automated test coverage.
Stack: Vitest, React Testing Library[cite: 28, 70].

Task:
Write frontend tests for ReceivablesPage:
- Badge rendering based on status (Quitado/Parcial/Pendente)
- Payment modal open/close
- Overpayment validation guard prevents submit
- Toast messages display on success/error
- Protected route blocks unauthenticated access
- Balance display per person

Deliverable: ✅ 21 ReceivablesPage frontend tests passing. Coverage includes:
- Rendering (4): page title, loading state, empty state, API error message
- Badge Rendering (3): 🔴 Pendente, ⚠️ Parcial, ✅ Quitado — using regex matchers for emoji-prefixed text
- Action Buttons (2): "Registrar Pagamento" for PENDENTE/PARCIAL orders, "Pago" label for QUITADO orders
- Payment Modal (6): modal open with balance fetch, person dropdown with pending values, balance display per person, empty pending state, close via "Cancelar", close via × button
- Validation Guards (4): zero/negative amount rejection ("Valor deve ser maior que zero"), overpayment rejection ("Valor excede o saldo pendente"), valid payment POST submission
- Toast Feedback (2): success toast "Pagamento registrado com sucesso!", error toast for backend overpayment rejection
Total frontend tests: 53 (14 PeoplePage + 18 OrdersPage + 21 ReceivablesPage). All existing backend tests (57) pass with no regressions.

---

📈 PHASE 13: Frontend Dashboard & Charts
Status: ✅ COMPLETED

Context: All ledger transactional pipelines operate normally. Need high-level analytics layout[cite: 71, 146, 152].
Stack: React, Recharts, Axios[cite: 28, 72].

Task:
Develop `src/pages/DashboardPage.jsx`[cite: 74, 148, 153]. Design an analytic interface incorporating:
1. KPI Status Widgets: Displays metrics for "Total Pendente", "Total Quitado", and "Recebimentos (Mês Atual)"[cite: 72, 74, 149, 153].
2. Performance Bar Graphs: Using Recharts, plot balances due indexed by Person[cite: 74, 149].
3. Add navigation link to Dashboard in AppLayout.

Deliverable: ✅ A dashboard where KPIs and charts render correctly with real data from the backend. Navigation includes Dashboard link. Backend: `GET /api/dashboard` (JWT-protected) returns totalPending, totalPaid, currentMonthReceipts, personBalances[]. Frontend: DashboardPage with 3 KPI widgets (🔴 Total Pendente, ✅ Total Quitado, 💰 Recebimentos Mês Atual) formatted as BRL, plus Recharts BarChart "Saldos por Pessoa" with Itens (blue) and Pagamentos (green) bars. Deleted persons displayed as "Sem pessoa". Tooltip with BRL formatting, Y-axis tick formatter (R$ 1.5k). Empty state "Nenhum saldo por pessoa". Loading spinner and error handling with PT-BR messages. "Dashboard" nav link added as first link in AppLayout. Existing backend tests (57) and frontend tests (53) pass with no regressions.

---

🧪 PHASE 14: Frontend Tests — Dashboard & Charts
Status: ✅ COMPLETED

Context: Frontend Dashboard is implemented. Need automated test coverage.
Stack: Vitest, React Testing Library, Recharts[cite: 28, 72].

Task:
Write frontend tests for DashboardPage:
- KPI widgets render correct values
- Chart component renders with data
- Protected route guards dashboard
- Navigation link to Dashboard present
- Empty state handling (no orders/payments)

Also fixed floating-point precision bug across backend and frontend:
- Created shared `src/utils/money.js` (backend + frontend) with `toCents`, `fromCents`, `formatBRL`
- Refactored `paymentsController.js` and `dashboardController.js` to use integer cents internally
- Refactored `ReceivablesPage.jsx` and `OrdersPage.jsx` to use cents for validation/calculation
- Fixed `formatBRL` to handle string inputs (Prisma Decimal fields return strings)
- Added 2 regression tests for floating-point edge case (1234.56-1233=1.56)

Deliverable: ✅ 12 DashboardPage frontend tests passing. Coverage includes:
- Rendering (4): page title, loading state, API error message, 401 session expired
- KPI Widgets (5): "Total Pendente", "Total Quitado", "Recebimentos (Mês Atual)" labels, BRL currency formatting, zero values
- Chart (3): "Saldos por Pessoa" title with data, empty state "Nenhum saldo por pessoa", chart container present
Total frontend tests: 66 (14 PeoplePage + 18 OrdersPage + 22 ReceivablesPage + 12 DashboardPage).
Total backend tests: 59 (14 people + 20 orders + 25 payments).

---

📥 PHASE 15: Frontend XLSX Export Feature
Status: ✅ COMPLETED

Context: Dashboard is operational. Need Excel export functionality[cite: 71, 146, 152].
Stack: React, SheetJS (xlsx library)[cite: 28, 72].

Task:
Implement client-side Excel exporter:
1. Add an action element labeled "📥 Exportar para Excel" on the DashboardPage[cite: 72, 150, 153].
2. Compile active application context into a `.xlsx` data workbook split by descriptive sheets: "Pedidos", "Pessoas", "Histórico de Pagamentos", "Saldo Pendente"[cite: 72, 150, 153].
3. Force cells formatting to follow BRL monetary mask[cite: 75, 76, 150].
4. Trigger browser download of the generated file.

Deliverable: ✅ Excel exporter button generates a downloadable `.xlsx` workbook with properly formatted Brazilian currency data across multiple sheets.
- Installed `xlsx` (SheetJS v0.18.5) as frontend dependency
- Created `frontend/src/utils/exportExcel.js` — export utility generating 4-sheet workbook:
  - "Pedidos": orderNumber, orderDate (DD/MM/YYYY), totalValue (BRL #,##0.00), status
  - "Pessoas": name, contact
  - "Histórico de Pagamentos": orderNumber, personName, amount (BRL), paidAt (DD/MM/YYYY), notes
  - "Saldo Pendente": personName, itemTotal (BRL), paymentTotal (BRL), pending (BRL)
- Updated `DashboardPage.jsx` — added "📥 Exportar para Excel" button in header, fetches /api/orders, /api/people, /api/dashboard concurrently on click, calls exportExcel utility, triggers browser download of `relatorio-recebiveis.xlsx`
- BRL currency formatting applied to all monetary cells via SheetJS number format `#,##0.00`
- Export button disabled when no data available (all KPIs zero and no personBalances)
- Loading state "Exportando..." with spinner during export fetch
- Toast feedback: "Relatório exportado com sucesso!" (success) / "Erro ao exportar relatório." (error)
- No new backend endpoints needed — reuses existing /api/orders, /api/people, /api/dashboard
- Updated DashboardPage.test.jsx — added ToastProvider wrapper, exportExcel mock, mock handlers for /orders and /people endpoints
- All existing tests pass with no regressions: 66 frontend, 59 backend

---

🧪 PHASE 16: Frontend Tests — XLSX Export
Status: ✅ COMPLETED

Context: XLSX export feature is implemented. Need automated test coverage.
Stack: Vitest, React Testing Library, SheetJS[cite: 28, 72].

Task:
Write frontend tests for XLSX export:
- Export button triggers XLSX download
- BRL currency formatting in exported cells
- Workbook contains correct sheet names ("Pedidos", "Pessoas", "Histórico de Pagamentos", "Saldo Pendente")
- Export button disabled when no data available

Deliverable: ✅ All XLSX export frontend tests passing. Export functionality, formatting, and sheet structure fully covered.
- Created `frontend/tests/exportExcel.test.js` — 32 unit tests:
  - Workbook Structure (3): 4 sheets, correct names, filename "relatorio-recebiveis.xlsx"
  - Pedidos Sheet (4): headers, rows, DD/MM/YYYY dates, BRL monetary cells (#,##0.00)
  - Pessoas Sheet (3): headers, rows, empty string for null contact
  - Histórico de Pagamentos Sheet (6): headers, payment rows, BRL format, DD/MM/YYYY dates, notes, "Sem pessoa" for null person, skip orders with no payments
  - Saldo Pendente Sheet (4): headers, balance rows, all 3 monetary columns BRL-formatted, string values from Prisma Decimal
  - Empty Data Handling (6): all 4 sheets created with empty inputs, headers-only, null/undefined inputs
  - Column Widths (4): `!cols` set on all 4 sheets
  - Floating-Point Precision (1): 1234.56-1233=1.56 without FP errors
- Updated `frontend/tests/DashboardPage.test.jsx` — 7 export integration tests (12 → 19):
  - "Exportar para Excel" button rendered, disabled when no data, enabled when data, calls exportExcel, success toast, error toast, "Exportando..." loading
- Total frontend tests: 105 (14 + 18 + 22 + 19 + 32)
- Total backend tests: 59 (14 + 20 + 25) — no regressions

---

📅 PHASE 17: Custom Order Date on Registration
Status: ✅ COMPLETED

Context: Client requested the ability to specify the order date at registration time, instead of always defaulting to the current timestamp.

Task:
Implement custom orderDate support across backend and frontend:
1. Backend: Add optional `orderDate` string field to `createOrderSchema` and `updateOrderSchema` (Zod). Parse YYYY-MM-DD strings as local dates using `parseLocalDate()` to avoid UTC timezone shifts. Update ordering to `[{ orderDate: 'desc' }, { createdAt: 'desc' }]`.
2. Frontend: Add `<input type="date">` field labeled "Data do Pedido" in create/edit modals, pre-filled with today's date on create and with `order.orderDate` on edit. Add "Data" column to orders table formatted as DD/MM/YYYY. Send `orderDate` in POST/PUT requests.
3. Tests: Backend — create with custom date, create without date (defaults to now), update date. Frontend — date column header, formatted dates in table, date field in create modal, pre-filled today, send orderDate on create, pre-filled on edit.

Deliverable: ✅ Custom order date fully implemented and tested. Orders can be created/updated with a specific date. Table displays date in DD/MM/YYYY format. Excel export already uses `order.orderDate || order.createdAt` so it integrates seamlessly.
- Backend: 62 tests passing (14 People + 23 Orders + 25 Payments)
- Frontend: 111 tests passing (14 PeoplePage + 24 OrdersPage + 22 ReceivablesPage + 19 DashboardPage + 32 exportExcel)
- **Total: 215 tests passing with zero regressions**

---

📅 PHASE 18: Custom Payment Date on Receivables Modal
Status: ✅ COMPLETED

Context: Client requested the ability to specify the payment date when registering a payment on the Receivables page. The modal should show today's date by default but allow the user to change it to a different date.

Task:
Implement custom paidAt date support across backend and frontend:
1. Backend: Add optional `paidAt` string field to `paymentSchema` (Zod). Parse YYYY-MM-DD strings as local dates using `parseLocalDate()` to avoid UTC timezone shifts (same pattern as orderDate). Pass parsed date to `tx.payment.create()`.
2. Frontend: Add `<input type="date">` field labeled "Data do Pagamento" in the payment modal on ReceivablesPage, pre-filled with today's date via `getTodayString()`. Send `paidAt` in POST request. Reset date to today when opening/closing the modal.
3. Tests: Backend — create payment with custom paidAt date (verify date stored correctly), create payment without paidAt (defaults to now). Frontend — date input visible with label, defaults to today, allows changing date, sends paidAt in request payload, resets date when reopening modal.

Deliverable: ✅ Custom payment date fully implemented and tested. Payment modal now includes a "Data do Pagamento" date input defaulting to today. Users can change the date before registering a payment. Backend accepts optional `paidAt` field and parses it timezone-safe.
- Backend: 64 tests passing (14 People + 23 Orders + 27 Payments — 2 new paidAt tests)
- Frontend: 116 tests passing (14 PeoplePage + 24 OrdersPage + 27 ReceivablesPage + 19 DashboardPage + 32 exportExcel — 5 new payment date tests)
- **Total: 180 tests passing with zero regressions**

---

📊 PHASE 19: Dashboard Yearly Breakdown (Pendente/Quitado por Ano)
Status: ✅ COMPLETED

Context: The dashboard showed only global KPIs and per-person balances, with no breakdown by year. The client requested the ability to see total pending and total paid-off amounts per year.

Stack: Node.js, Express, React, Tailwind CSS, Vitest[cite: 28, 72].

Task:
Implement a yearly breakdown section in the dashboard that groups orders by their order year:
1. Backend: Add `yearlyBreakdown` to `GET /api/dashboard` response. For each year (derived from `order.orderDate`), compute:
   - `totalPending`: sum of `totalValue` for orders with status PENDENTE or PARCIAL
   - `totalQuitado`: sum of `totalValue` for orders with status QUITADO
   - Sorted by year descending
2. Frontend: Add a "Resumo por Ano" table below the existing KPI cards and chart showing columns: Ano, Pendente (red), Quitado (green). Values formatted as BRL. Empty state: "Nenhum dado por ano".
3. Tests: Backend — 5 integration tests verifying structure, pending/quitado grouping, PARCIAL inclusion in pending, descending sort, orderDate-based grouping (not payment date). Frontend — 7 tests verifying table title, headers, year values, BRL formatting, row count, and empty state.

Deliverable: ✅ Dashboard shows a "Resumo por Ano" table with pending and quitado totals per year, sorted descending. Orders are grouped by their `orderDate` year regardless of when payments occur. All existing tests pass with zero regressions.
- Backend: 69 tests passing (14 People + 23 Orders + 27 Payments + 5 Dashboard)
- Frontend: 133 tests passing (14 PeoplePage + 24 OrdersPage + 27 ReceivablesPage + 26 DashboardPage + 32 exportExcel + 10 api)
- **Total: 202 tests passing with zero regressions**

---

👥 PHASE 20: Database Schema & User Registration
Status: ✅ COMPLETED

Context: The current system is single-tenant. To support multiple users, we need to isolate data and provide a way for new users to join.

Stack: Prisma, PostgreSQL, Express, bcryptjs, Zod[cite: 28].

Task:
1. Updated `Prisma` schema: Added `userId` (optional, String?) to `Person` and `Order` models for Phase 20.
2. Defined `User` ↔ `Person` (0..N) and `User` ↔ `Order` (0..N) relations with `ON DELETE SET NULL`.
3. Created a compound unique constraint `@@unique([orderNumber, userId])` on `Order` to allow numeric overlaps between different users (Phase 21 will make `userId` required).
4. Implemented `POST /api/auth/register` in `authController.js` and `authRoutes.js` (Zod validation, bcrypt hashing, duplicate username check → 409, returns user without password field).
5. **TDD**: Wrote `backend/tests/auth.test.js` with 4 tests: success 201 with password excluded, duplicate username 409, short password 400, short username 400.

Deliverable: ✅ Database migrated with `userId` support and a working registration API endpoint.
- New migration: `20260614000001_add_user_id_fields`
- New endpoint: `POST /api/auth/register` (Zod validation → 400, duplicate → 409, success → 201)
- New test file: `backend/tests/auth.test.js` (4 tests)
- All existing tests pass with zero regressions
- Backend: 82 tests (17 People + 27 Orders + 28 Payments + 6 Dashboard + 4 Auth)
- Frontend: 133 tests (no changes needed)
- **Total: 215 tests passing**

Note: `userId` is nullable for Phase 20 to maintain backward compatibility with existing data. Phase 21 made it required and enforced data isolation via JWT authentication on all routes.

---

🔒 PHASE 21: Backend Data Isolation & Auth Enforcement
Status: ✅ COMPLETED

Context: Backend endpoints previously accessed all data globally. Authentication has been enforced and all queries are scoped to the authenticated user.

Task Completed:
1. ✅ `userId` made required (`String?` → `String`) in `Person` and `Order` models with `ON DELETE CASCADE`.
2. ✅ New Prisma migration `20260614184002_make_user_id_required` with safe backfill of existing NULL values.
3. ✅ `authenticateToken` middleware applied to ALL routes in `peopleRoutes.js` and `ordersRoutes.js` (via `router.use()`).
4. ✅ All controllers (`peopleController`, `ordersController`, `paymentsController`, `dashboardController`) filter Prisma queries by `req.user.userId`.
5. ✅ Person lookups in order/item/payment operations are scoped to the authenticated user.
6. ✅ Items and payments validated against the owner of the parent order.
7. ✅ All 73 existing backend tests adapted with authentication headers and `userId` association.
8. ✅ 9 new tests added: 401/403 auth tests for people, orders, dashboard + isolation tests (cross-user access for items and payments).

Deliverable: Complete data isolation at the API level. All data operations are securely scoped to the authenticated user.
- New migration: `20260614184002_make_user_id_required`
- Backend: 82 tests (17 People + 27 Orders + 28 Payments + 6 Dashboard + 4 Auth)
- Frontend: 133 tests (no changes needed)
- **Total: 215 tests passing**

---

🖥️ PHASE 22: Frontend Registration & User Context
Status: ✅ COMPLETED

Context: Users need a UI to create accounts and the application must handle the registration flow.

Task:
1. Create `src/pages/RegisterPage.jsx` with a registration form in PT-BR (Usuário, Senha, Confirmar Senha).
2. Add "Criar uma conta" link to `LoginPage.jsx` for navigation.
3. Update `AuthContext.jsx` to include a `register(username, password)` function.
4. **TDD**: Write frontend tests for `RegisterPage` (rendering, validation, success redirect, error handling) and `LoginPage` navigation.

Deliverable: ✅ Fully functional multi-user system with self-registration and isolated user data workspaces.
- Created `RegisterPage.jsx` with PT-BR form (Usuário, Senha, Confirmar Senha), client-side validation (username min 3 chars, password min 6 chars, password match), loading state, error handling (409 conflict, generic), and navigation to login on success.
- Updated `LoginPage.jsx` with "Criar uma conta" link to `/register` and success message display from registration redirect.
- Updated `AuthContext.jsx` with `register(username, password)` function calling `POST /api/auth/register`.
- Updated `App.jsx` with `/register` route (public, no auth required).
- Created `RegisterPage.test.jsx` — 18 tests (rendering, validation, success redirect, error handling, loading state, navigation).
- Created `LoginPage.test.jsx` — 9 tests (rendering, registration link, success message, login form behavior).
- Frontend: 160 tests passing (14 PeoplePage + 24 OrdersPage + 27 ReceivablesPage + 26 DashboardPage + 32 exportExcel + 10 api + 18 RegisterPage + 9 LoginPage)
- Backend: 82 tests (no changes, zero regressions)
- **Total: 242 tests passing with zero regressions**

---

📱 PHASE 23: Responsive Header with Mobile Bottom Navigation
Status: ✅ COMPLETED

Context: The header menu was not responsive on mobile devices — it caused horizontal scrolling and overflow. The client requested a differentiated visual with a modern mobile experience.

Stack: React, Tailwind CSS, lucide-react, React Router NavLink

Task:
Implement a fully responsive header with a differentiated visual design:
1. **Desktop (≥768px)**: Horizontal top navigation bar with gradient background (`from-blue-800 to-blue-600`), white text. Layout: title "Controle de Recebíveis" on the left; nav links (Dashboard, Pessoas, Pedidos, Recebíveis) and Sair button on the right. Active link highlighted with `bg-white/20`. All `<a href>` replaced with `<NavLink>` for SPA navigation and active state detection.
2. **Mobile (<768px)**: Slim top bar with gradient showing only the title. **Fixed bottom navigation bar** with 5 items — Dashboard, Pessoas, Pedidos, Recebíveis (using lucide-react icons) and Sair button. Active route highlighted with full opacity (`text-white` vs `text-white/60`).
3. **Library**: Added `lucide-react` for SVG icons (LayoutDashboard, Users, ClipboardList, DollarSign, LogOut). No manual SVG code needed.
4. **TDD**: Wrote tests before implementation — Header.test.jsx (4 tests) and MobileBottomNav.test.jsx (6 tests).

Deliverable: ✅ Fully responsive header with gradient design on both desktop and mobile. Bottom navigation bar with lucide-react icons enables thumb-friendly mobile navigation. Content has `pb-20 md:pb-6` padding to avoid overlap with the fixed bottom nav.
- Frontend: 170 tests passing (4 Header + 6 MobileBottomNav + 160 existing)
- Backend: 82 tests passing (zero regressions)
- **Total: 252 tests passing with zero regressions**

---

🔤 PHASE 24: Mobile UX Improvements — Username Lowercase Default & Password Visibility Toggle
Status: ✅ COMPLETED

Context: On mobile, the virtual keyboard auto-capitalizes the first letter of text inputs, forcing users to manually correct when typing lowercase usernames. Additionally, password fields hide what was typed without any way to visually confirm correctness.

Stack: React, Tailwind CSS, lucide-react

Task:
1. **Username fields**: Added `autoCapitalize="none"` and `autoCorrect="off"` attributes to username inputs on both LoginPage and RegisterPage to prevent mobile virtual keyboards from auto-capitalizing the first letter.
2. **Password toggle**: Added `Eye`/`EyeOff` icon buttons (from lucide-react) to password and confirm password fields on both pages. Clicking the button toggles the input type between `"password"` and `"text"`, allowing the user to see what they typed.
3. **Tests**: Added 3 new tests — 1 for LoginPage password toggle, 2 for RegisterPage (password + confirm password toggle). All existing tests continue to pass.

Deliverable: ✅ Username inputs now default to lowercase on mobile keyboards. Password fields have a visibility toggle (eye icon) for user confirmation.
- Backend: 82 tests passing (unchanged)
- Frontend: 173 tests passing (170 + 3 new)
- **Total: 255 tests passing with zero regressions**

---

---

👤 PHASE 25: Logged-in User Badge
Status: ✅ COMPLETED

Context: The application has multi-user support, but there was no visual indicator of which user is currently logged in. Users needed to see their username displayed in the UI.

Stack: React, jwt-decode, lucide-react (User icon), Docker

Task:
1. Install jwt-decode in the frontend and modify AuthContext.jsx to decode the JWT token payload (userId, username) on login and page load, exposing a `user` object in the context.
2. Update Header.jsx to display a username badge with the User icon between the theme toggle and Sair button on desktop (`hidden md:inline-flex`).
3. Update MobileBottomNav.jsx to display the username badge with a clickable dropdown menu containing the Sair option (prepared for future options), using `useRef` + click-outside detection.
4. Fix Docker startup to ensure `npm install` runs on container start — add it to frontend CMD and backend entrypoint.sh — so that anonymous volumes receive new dependencies after `docker compose up --build`.
5. TDD: Write 2 new Header tests (username display when logged in, hidden when not logged in). Update MobileBottomNav tests for dropdown behavior + click-outside close.

Deliverable: ✅ Logged-in user badge in header (desktop) and clickable dropdown with Sair option in mobile bottom nav.
- Installed jwt-decode v4.0.0
- AuthContext.jsx: decodes JWT with `jwtDecode()`, exposes `user: { id, username, } | null`
- Header.jsx: badge `<User icon + username>` between theme toggle and Sair
- MobileBottomNav.jsx: badge `<User icon + username>` opens dropdown with Sair option (extensible via `userMenuItems` array)
- Docker: frontend CMD runs `npm install && npm run dev`; backend entrypoint.sh runs `npm install` before migrations
- Frontend: 183 tests passing (+2 Header tests, +1 MobileBottomNav test, 183 total)
- Backend: 82 tests passing (zero regressions)
- Total: 265 tests passing with zero regressions

---

🛠️ PHASE 26: Z-Index Bug Fix — Modals Hidden Behind Mobile Bottom Nav
Status: ✅ COMPLETED

Context: On mobile devices, when opening modals (create/edit person, create/edit order, register payment), the modal overlay had `z-50` — the same z-index as the fixed mobile bottom navigation bar. Since `MobileBottomNav` is rendered after page content in the DOM (inside `AppLayout` in `App.jsx`), it appeared on top of modals, hiding Cancelar/Salvar buttons at the bottom.

Stack: Tailwind CSS

Task:
Identified and fixed the z-index conflict between modals and the mobile bottom navigation:

1. Changed all modal overlay z-index values from `z-50` to `z-[60]` across 3 files (4 modals total):
   - `frontend/src/pages/OrdersPage.jsx:250` — create/edit order modal
   - `frontend/src/pages/PeoplePage.jsx:174, 216` — create and edit person modals
   - `frontend/src/pages/ReceivablesPage.jsx:221` — payment registration modal

2. Documented the lesson learned in AGENTS.md as lesson #18 with example code and z-index hierarchy recommendation (nav `z-50` → modals `z-[60]` → toasts `z-[70]`).

Deliverable: ✅ All modals now render above the mobile bottom navigation bar, making Cancelar/Salvar buttons accessible on mobile devices regardless of form length.
- No test changes needed (purely CSS fix, no behavioral change)
- All existing 265 tests continue to pass

---

## 🎉 MVP PROJECT COMPLETION


**All 16 phases + Phases 17-25 have been successfully completed.** The Receivables Control System is now a fully functional, production-ready financial tracking application with comprehensive test coverage.

### Summary of Deliverables:

✅ **Backend (Node.js + Express + Prisma)**
- User authentication with JWT (stateless)
- User registration (self-service account creation)
- People management (CRUD with validation)
- Orders management with nested items (CRUD with dynamic sub-forms and custom order date)
- Payments processing with automatic status transitions and custom payment date
- Dashboard aggregation (KPIs, per-person balances, and yearly breakdown)
- Financial calculations using integer cents arithmetic (no floating-point errors)

✅ **Frontend (React + Vite + Tailwind)**
- Login and authentication flow
- User registration page (PT-BR with validation)
- People management page (CRUD with modals)
- Orders management page (CRUD with dynamic item rows and custom order date)
- Receivables tracking page (payment processing modal with validation and custom payment date)
- Analytics dashboard with KPI widgets, Recharts visualizations, and yearly breakdown table
- Excel export functionality (4-sheet workbook with BRL formatting)

✅ **Database (PostgreSQL 15)**
- Relational schema with User, Person, Order, Item, Payment entities
- Proper relationships and cascade behavior
- Decimal(10,2) monetary precision

✅ **Testing (Vitest + React Testing Library)**
- Backend: 82 tests (17 People + 27 Orders + 28 Payments + 6 Dashboard + 4 Auth)
- Frontend: 183 tests (14 PeoplePage + 24 OrdersPage + 27 ReceivablesPage + 26 DashboardPage + 32 exportExcel + 10 api + 20 RegisterPage + 10 LoginPage + 6 Header + 7 MobileBottomNav + 7 ThemeContext)
- **Total: 265 tests passing**
- 100% TDD methodology applied
- Comprehensive edge case coverage (overpayment validation, status transitions, floating-point precision)

✅ **Infrastructure (Docker)**
- Multi-container Docker Compose setup
- Persistent PostgreSQL volume
- Live code reload for backend and frontend
- Adminer database UI included

✅ **Localization**
- All user-facing content in Portuguese (Brazil)
- Date/time formatting: DD/MM/YYYY
- Currency formatting: BRL with pt-BR locale (R$ 1.234,56)

### Test Results Summary:
```
┌─────────────────────────┬───────────────────┬──────────────┐
│ Component               │ Test Count        │ Status       │
├─────────────────────────┼───────────────────┼──────────────┤
│ Backend - People        │ 17 tests passing  │ ✅ Complete  │
│ Backend - Orders        │ 27 tests passing  │ ✅ Complete  │
│ Backend - Payments      │ 28 tests passing  │ ✅ Complete  │
│ Backend - Dashboard     │ 6 tests passing   │ ✅ Complete  │
│ Backend - Auth          │ 4 tests passing   │ ✅ Complete  │
│ Frontend - People       │ 14 tests passing  │ ✅ Complete  │
│ Frontend - Orders       │ 24 tests passing  │ ✅ Complete  │
│ Frontend - Receivables  │ 27 tests passing  │ ✅ Complete  │
│ Frontend - Dashboard    │ 26 tests passing  │ ✅ Complete  │
│ Frontend - exportExcel  │ 32 tests passing  │ ✅ Complete  │
│ Frontend - RegisterPage  │ 20 tests passing  │ ✅ Complete  │
│ Frontend - LoginPage     │ 10 tests passing  │ ✅ Complete  │
│ Frontend - api           │ 10 tests passing  │ ✅ Complete  │
│ Frontend - Header       │ 6 tests passing   │ ✅ Complete  │
│ Frontend - MobileBottomNav │ 6 tests passing │ ✅ Complete  │
├─────────────────────────┼───────────────────┼──────────────┤
│ TOTAL │ 265 tests passing │ ✅ LOGGED-IN USER BADGE COMPLETE │
└─────────────────────────┴───────────────────┴──────────────┘
```

### Critical Lessons Learned (Documented in AGENTS.md):

1. **vi.mock hoisting bug (Vitest)** — Use arrow-function wrappers for mock factories
2. **HTML5 required attribute in jsdom** — Use fireEvent.submit(form) to bypass validation
3. **Dynamic list item removal** — Verify items count before testing remove buttons
4. **dotenv.config() in tests** — Set NODE_ENV=test before module imports
5. **Frontend module support** — Add "type": "module" to frontend/package.json
6. **React Router nested routes** — Use Outlet pattern instead of nested Routes
7. **Prisma Decimal fields** — Returns strings, not numbers; use parseFloat()
8. **Docker node_modules conflicts** — Remove and reinstall when permissions conflict
9. **Prisma transaction stale data** — Manually add new records when re-evaluating status
10. **formatBRL string handling** — Parse to number before toLocaleString()
11. **Non-breaking space in BRL** — Use `\s*` regex to match any whitespace
12. **Floating-point precision** — Use integer cents arithmetic throughout
13. **vi.hoisted() for mock variables** — Use `vi.hoisted()` when ES module imports are hoisted above `const` declarations
14. **Backend 403 for expired token** — Frontend interceptor must handle both 401 and 403

## 🚀 Next Steps: Handling New Client Requests

When the client requests new features, follow this workflow:

### 1. **Create New Phase Plan**
   - Add a new section in this ROADMAP.md file
   - Use format: `🔤 PHASE [N+1]: [Feature Name]`
   - Document Context, Stack, and Task clearly

### 2. **Define Acceptance Criteria**
   - List all expected user-facing behaviors
   - Document PT-BR labels and UI elements
   - Identify edge cases and validation rules
   - Specify any database schema changes needed

### 3. **Plan Test Coverage**
   - Identify backend tests needed (Vitest + supertest)
   - Identify frontend tests needed (React Testing Library)
   - Plan for integration tests if cross-layer dependency exists
   - Estimate test count

### 4. **Implement with TDD Discipline**
   - Write tests BEFORE implementation (phases 5+)
   - Follow the patterns established in existing tests:
     - Backend: use uniqueOrderNumber(), track created entities, cleanup in afterEach
     - Frontend: use arrow-function mock pattern, ToastProvider wrapper, regex matchers for pt-BR content
   - Use shared utilities (src/utils/money.js for BRL calculations)
   - Maintain integer cents arithmetic for all financial operations

### 5. **Update Documentation After Completion**
   - Update ROADMAP.md with Deliverable section
   - Update ARCHITECTURE.md if folder structure or services change
   - Update AGENTS.md if new technical specifications or rules emerge
   - Document any new environment variables or dependencies
   - Add new test scripts to the "Available Test Scripts" section in AGENTS.md

### 6. **Verify All Tests Pass**
   - Run `npm run test` in backend and frontend directories
   - Verify 242+ existing tests still pass (no regressions)
   - Verify new tests pass
   - Check test coverage for the new feature

### 7. **Prepare Docker Image (if applicable)**
   - Test with `docker compose up --build`
   - Verify all services start correctly
   - Verify frontend/backend communicate correctly

### Example New Phase Template:

```
[Icon] PHASE [N+1]: [Feature Name]
Status: 🔄 IN PROGRESS

Context: [Previous phase context and why this feature is needed]
Stack: [Technologies to be used]

Task:
Implement [feature]. Provide:
1. [Backend requirement]
2. [Frontend requirement]
3. [Test requirement]

Deliverable: ✅ [What users will have] - [Backend tests passing] backend tests, [Frontend tests passing] frontend tests
```

---

🎨 PHASE 24: Design System Unification + Dark Mode
Status: ✅ COMPLETED

Context: The header already had a modern gradient design (from-blue-800 to-blue-600), but the rest of the application was visually inconsistent: emojis mixed with lucide-react icons, different shadow levels, inconsistent badge styles, plain buttons, and no dark mode support.
Stack: Tailwind CSS, lucide-react, React Context

Task:
Implemented a comprehensive design system unification that:
1. Added `darkMode: 'class'` strategy to tailwind.config.js for manual dark mode toggling
2. Created semantic `primary` color tokens (50–900) mapped to blue palette in tailwind.config.js
3. Added CSS custom properties for brand gradient with dark mode overrides in index.css
4. Created ThemeContext with localStorage persistence, system preference detection, and manual toggle via Sun/Moon icons
5. Added inline blocking script in main.jsx to prevent flash of wrong theme before React renders
6. Applied border-t-4 border-primary-600 accent to all cards, modals, and auth forms
7. Replaced all emoji icons (🔴✅💰📥) with lucide-react components (Circle, CheckCircle, DollarSign, Download)
8. Unified status badges across OrdersPage and ReceivablesPage with colored dot indicators (amber/blue/emerald)
9. Replaced bg-blue-600 solid primary buttons with bg-gradient-to-r from-primary-700 to-primary-500 gradient
10. Added glassmorphism overlay (bg-black/40 backdrop-blur-sm) to all modals
11. Added dark: variants to every component (headers, cards, tables, inputs, badges, modals, buttons)
12. Standardized input focus rings to use primary-500 with focus:border-primary-500 everywhere
13. Changed action links from indigo-600 to primary-600 for consistency
14. Removed dead CSS class `.yearly-breakdown-table`, replaced with `data-testid="yearly-breakdown"`
15. Added ThemeContext test suite (7 tests) verifying toggle, persistence, dark class management, and provider guard

Deliverable: ✅ Unified design system with dark mode support across the entire app - 180 frontend tests passing (+7 new), 82 backend tests passing (262 total)

---

## 🎯 Phase 26: Interactive User Onboarding Tour
Status: ✅ COMPLETED

Context: New users need guidance to understand the system's features. Phase 26 adds an interactive step-by-step tutorial that introduces key sections (Dashboard, People, Orders, Receivables) in a guided modal tour.

Stack: React, lucide-react, localStorage, window CustomEvent.

Task:
- Created `frontend/src/components/OnboardingTour.jsx` with:
  - 8 tour steps covering all major features (Welcome → KPIs → Charts → People → Orders → Receivables → Navigation → Completion)
  - Custom modal overlay with backdrop (z-[70]), icon, title, description, progress dots, and step counter
  - Navigation between steps with "Anterior"/"Próximo"/"Pular Tutorial"/"Começar a Usar!" buttons
  - Cross-page navigation via `useNavigate()` on appropriate steps
  - localStorage flags: `show_onboarding` (auto-trigger after registration), `onboarding_complete` (persist completion)
  - Custom event `start-onboarding-tour` for external triggers
  - Consistent dark mode with rest of the app

- Modified `frontend/src/pages/RegisterPage.jsx`:
  - Sets `localStorage.setItem('show_onboarding', 'true')` after successful registration

- Modified `frontend/src/App.jsx`:
  - Renders `<OnboardingTour />` inside `AppLayout` (after `MobileBottomNav`)

- Modified `frontend/src/components/Header.jsx`:
  - Added `HelpCircle` button with `title="Tutorial"` between theme toggle and user badge

- Modified `frontend/src/components/MobileBottomNav.jsx`:
  - Added "Tutorial" item in the user dropdown (above "Sair")
  - Both trigger `window.dispatchEvent(new Event('start-onboarding-tour'))`

- Updated `tests/MobileBottomNav.test.jsx`:
  - Adjusted button count assertion (2 → 4 in dropdown) to account for new Tutorial button
  - Added assertion for `screen.getByText('Tutorial')`

Key Design Decisions:
- Custom component (no external dependencies like react-joyride/driver.js) — lighter bundle, full control
- Modal-based (not spotlight/pointer-to-element) — robust against DOM changes, works across page navigations
- Window CustomEvent pattern — clean inter-component communication without context pollution or prop drilling
- z-[70] overlay hierarchy — follows existing convention (z-50 nav → z-[60] modals → z-[70] tour overlay → z-[80] toasts)

Deliverable: ✅ Interactive 8-step onboarding tour with auto-trigger on first login after registration and manual restart via header/mobile nav — 183 frontend tests passing (no regressions), 265 total tests

---

## 🎯 Phase 27: Product Catalog (dōTERRA) with Price History
Status: ✅ COMPLETED

Context: Client needs a product table to load the dōTERRA catalog and, in the future, to answer "how much did this product cost in the past". The catalog is updated irregularly (sometimes years apart, sometimes within the same year), so the table must support incremental (diff) loads and preserve price history. The CRUD screen and order-item integration are planned for a future phase.

Stack: Prisma ORM, PostgreSQL, Node.js.

Task:
- Created `Product` model (`backend/prisma/schema.prisma`):
  - `code` (unique, dōTERRA product code, e.g. `60226006`), `name`, `size` (plain string, keeps original CSV text), `active` (boolean, false when the product leaves the list), timestamps
- Created `ProductPrice` model:
  - `regularPrice`, `memberPrice`, `pv` — all `Decimal(10,2)` (pv is Decimal, not Integer, because fractional PV values have occurred)
  - `validFrom` / `validTo` interval — `validTo` is NULL for the current price; when a price changes the old record is closed (`validTo`) and a new record is opened, preserving history
  - `onDelete: Cascade` from `Product`
- Migration `20260811174015_add_products` (created via `prisma migrate dev --name add_products`)
- CSV parser `backend/src/utils/csvParser.js` — pure function (`parseProductCsv`) + file wrapper (`parseProductCsvFile`); `;` delimiter, header skipped, monetary values kept as strings to preserve precision
- Intelligent loader `backend/src/utils/productLoader.js` — `loadProductCatalog(prisma, rows)`:
  - New products inserted with an active price record
  - Existing products have name/size synced and are reactivated if they were inactive
  - Price changes close the current price record (`validTo`) and open a new one
  - Products present in DB but missing from the CSV are deactivated
  - Idempotent — re-running an identical load changes nothing
  - Runs inside a Prisma transaction and returns a summary `{ created, updated, priceChanged, unchanged, deactivated, errors }`
- CLI wrapper `backend/scripts/loadProducts.js` + `npm run load:products`:
  - Defaults to `docs/tabela_produtos_doterra_2026.csv`, or accepts a custom path as argv
  - `--date YYYY-MM-DD` sets the validity start of the load, supporting **retroactive loads** (e.g., a new price table released weeks ago)
  - `--dry-run` previews the changes without persisting anything (rolls back the transaction and prints the summary)
  - Prints a loud warning when products are deactivated (they left the catalog)
  - Prints a PT-BR summary of what changed
- Initial load executed: 219 products + 219 price records from `docs/tabela_produtos_doterra_2026.csv` (all active, all with a current price)
- Tests: `backend/tests/productLoader.test.js` — 16 tests covering CSV parsing (precision, fractional pv, malformed rows) and loader behavior (initial load, idempotency, price-change history, metadata update, deactivate/reactivate, new product addition, retroactive `validFrom`, dry-run)
- Test isolation: loader tests snapshot and restore the real catalog's `active` flags (and deactivate non-TEST products in `beforeEach`), so running the suite never disables the real products

Key Design Decisions:
- Price history modeled as `validFrom`/`validTo` interval on `ProductPrice` instead of version snapshots or a separate `PriceList` table — answers historical price queries by date without duplicating the whole catalog per load
- Catalog is global (shared across all users) — it mirrors the official dōTERRA list
- Existing `Item`/`Order` tables untouched — no regression risk; product↔item linkage will be handled in the CRUD phase
- Monetary comparison uses integer cents (`toCents` from `src/utils/money.js`) to avoid floating-point drift
- Monetary values stored as `Decimal(10,2)` strings from the CSV to preserve exact decimal representation

Usage:
- Initial/future load: `DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables" npm run load:products -- <path-to-csv>`
- Retroactive validity: append `--date YYYY-MM-DD` (the load is valid from that date — closes the previous price record at that date and opens the new one)
- Safe preview before any real load: `--dry-run` (prints the summary, changes nothing)
- Inside the container the default `db` hostname works: `docker exec receivables_backend node scripts/loadProducts.js` (note: the `docs/` folder is not mounted in the container, so pass an accessible path or run from the host)
- Always load the **complete current catalog** — any product absent from the CSV is deactivated (see AGENTS.md lesson #20)

Deliverable: ✅ Product + ProductPrice tables with price history, an idempotent diff loader, retroactive `--date` support and safe `--dry-run` preview — 98 backend tests passing (82 + 16 new), 281 total tests

---

## 🎯 Phase 28: Product CRUD + Navigation Redesign (Mobile Drawer)
Status: ✅ COMPLETED

Context: The Product catalog tables from Phase 27 needed CRUD functionality. With 5 menu sections now (Dashboard, Pessoas, Pedidos, Recebíveis, Produtos), the mobile bottom navigation bar became overcrowded. The navigation was redesigned to use a hamburger/drawer pattern on mobile while keeping the desktop top nav.

Stack: Express, Prisma ORM, React, Tailwind CSS, lucide-react.

Task (Backend):
- Created `backend/src/controllers/productController.js` + `backend/src/routes/productRoutes.js`:
  - `GET /api/products` — list all products (optional `?active=true`), ordered by name, with current price projected to top-level fields
  - `GET /api/products/:id` — single product with current price (404 if not found)
  - `POST /api/products` — create product + initial `ProductPrice` in a transaction; 409 on duplicate `code`
  - `PUT /api/products/:id` — update name/size/active; price changes close the current price record (`validTo`) and open a new one, preserving history; **`code` is deliberately absent from the update Zod schema — it can never be changed via the API**
  - `DELETE /api/products/:id` — soft-delete (sets `active = false`), preserving referential integrity for future order-item integration
- Registered `/api/products` in `backend/src/app.js`
- `updateProduct` runs inside `prisma.$transaction`; price comparisons use `toCents` (integer cents) to avoid floating-point drift
- Tests: `backend/tests/products.test.js` — 21 tests covering create (validation, duplicate 409, auth 401/403), list (projection, active filter), get by id (404), update (metadata, code immutability, price history, unchanged-price no-op, 404, invalid data), and soft-delete

Task (Frontend — Navigation):
- Replaced `frontend/src/components/MobileBottomNav.jsx` with `frontend/src/components/MobileDrawer.jsx`:
  - Fixed mobile top bar (hamburger button, app title, theme toggle, user icon)
  - Slide-in drawer from the left with all 5 nav items, Tutorial, theme toggle area and Sair
  - Backdrop overlay that closes the drawer; `Escape` key support
  - `md:hidden` on all mobile elements — desktop uses the Header top nav
- Updated `frontend/src/App.jsx`: renders `<MobileDrawer />`, added `/products` route, adjusted main padding for the top-fixed mobile bar
- Updated `frontend/src/components/Header.jsx`: added Produtos link, hidden on mobile (`hidden md:block`)
- Updated `frontend/src/components/OnboardingTour.jsx`: added a "Catálogo de Produtos" step (tour now 9 steps)
- Tests: `frontend/tests/MobileDrawer.test.jsx` — 11 tests (title/hamburger, closed by default, open/close, 5 nav items, active highlight, logout, tutorial event, backdrop close, mobile-only)

Task (Frontend — ProductsPage):
- Created `frontend/src/pages/ProductsPage.jsx` mirroring the People CRUD pattern:
  - Table with Código, Produto, Tamanho, Preço Regular, Preço Membro, PV, Status (Ativo/Inativo badge), Ações
  - Create modal: editable `code` field + name, size, regular price, member price, PV
  - Edit modal: **`code` field disabled with "O código não pode ser alterado" helper** — name, size and status (Ativo/Inativo) editable
  - Desativar/Ativar actions per row via `PUT /api/products/:id` with `{ active }`
  - Dark mode support, `z-[60]` modal overlay per z-index convention
- Tests: `frontend/tests/ProductsPage.test.jsx` — 14 tests (rendering, table, status badges, create flow, validation, edit with disabled code, PUT payload, deactivate/activate with confirm)

Key Design Decisions:
- `code` immutability enforced twice: frontend disables the input on edit; backend omits `code` from the update Zod schema (API-level guarantee)
- Soft-delete (`active = false`) instead of hard delete — the loader (Phase 27) already relies on the `active` flag and future order-item links must not dangle
- Mobile drawer pattern scales to any number of menu items without crowding — the bottom-bar pattern was at its limit at 4 items + theme + user
- Product price edits preserve history the same way the loader does (close current `validTo`, open a new record)
- Catalog remains global (no `userId` isolation) — matches the Phase 27 shared-catalog decision

Deliverable: ✅ Full Product CRUD API + ProductsPage UI + mobile hamburger/drawer navigation — 119 backend tests (98 + 21 new), 201 frontend tests (183 − 7 + 11 MobileDrawer + 14 ProductsPage), 320 total tests

---

## 🎯 Phase 29: Product Search, Sorting & Infinite Scroll
Status: ✅ COMPLETED

Context: With 219+ products in the catalog, rendering the full list at once degraded the screen. The user requested a way to search (at least by name), pagination with a few items per time (infinite scroll), ordering mainly by price values and PV, and an active/inactive status filter.

Stack: Express, Prisma ORM, React, Tailwind CSS, IntersectionObserver.

Task (Backend):
- Extended `GET /api/products` in `backend/src/controllers/productController.js`:
  - `q` — partial search over `name` OR `code`, case-insensitive (Prisma `contains` + `mode: 'insensitive'`)
  - `sortBy` (name/code/regularPrice/memberPrice/pv, default `name`) + `sortDir` (asc/desc) — price/PV sorts compare parsed numeric values (Prisma Decimal returns strings), name/code use `pt-BR` localeCompare
  - `page` (1-based, default 1) + `pageSize` (default 20, clamped to max 100)
  - Response shape changed from a bare array to `{ data, pagination: { page, pageSize, total, totalPages, hasMore } }`
  - `active=true/false` filter preserved and combinable with search
- Sorting/pagination is done in-memory after fetching the filtered set (with current price projected) — the catalog size (~219) makes this negligible and avoids complex raw SQL for "current price" ordering
- Tests: `backend/tests/products.test.js` grew from 21 → 30 tests (partial-name search case-insensitive, code search, search+active combination, default name-asc sort, pv desc, regularPrice asc, memberPrice desc, page/pageSize pagination with hasMore, pageSize clamping)

Task (Frontend):
- Rewrote `frontend/src/pages/ProductsPage.jsx`:
  - Search box with `Search` icon (filters by name or code, resets to page 1)
  - Sort dropdown (`Ordenar por`): Nome A-Z/Z-A, Código A-Z, Preço Regular menor/maior, Preço Membro menor/maior, PV menor/maior
  - Status filter (`Status`): Todos / Somente ativos / Somente inativos
  - Product count line ("X produtos")
  - **Infinite scroll** via `IntersectionObserver` on a sentinel element at the bottom of the table (rootMargin 200px), appending 20 items per page; guards against duplicate requests (`loadingMore`/`hasMore` refs)
  - Distinct empty state: "Nenhum produto encontrado para os filtros aplicados." vs "Nenhum produto cadastrado"
  - "Carregando mais..." indicator while fetching the next page
- Tests: `frontend/tests/ProductsPage.test.jsx` grew from 14 → 20 tests (search API call, active filter API call, sort API call, filtered empty state, product count, infinite scroll loads page 2, no further requests when `hasMore` false)

Key Design Decisions:
- Infinite scroll keeps the DOM small (20 rows per page) — no full-list render that could jank on mobile
- Search is server-side (`q` param) so the result set is bounded regardless of catalog size
- IntersectionObserver chosen over a "Carregar mais" button — matches the requested UX and scales to huge catalogs
- Sorting by current price happens in JS on the backend since "current price" is a `validTo IS NULL` window; DB-level ordering by a to-many relation would need raw SQL for little gain at this scale

Deliverable: ✅ Searchable, sortable, filterable product list with infinite scroll — 128 backend tests (119 + 9 new), 207 frontend tests (201 + 6 new), 335 total tests

## 🎯 Phase 30: Client-Side Search, Sort & Status Filter (Load-Once)
Status: ✅ COMPLETED

Context: After Phase 29, the user refined the UX: the search box hit the backend on every keystroke. Since the catalog is rarely updated, the full list should be loaded once into browser memory and search/order/status filtering applied entirely in the frontend — no new backend call per filter or sort change.

Stack: Express, Prisma ORM, React, Tailwind CSS, IntersectionObserver, `useMemo`.

Task (Backend):
- `GET /api/products` in `backend/src/controllers/productController.js` now accepts `pageSize=all` (special string value) to return the **entire** matching list in one response (`pageSize` in the pagination envelope equals the total). Numeric `pageSize` clamping (max 100) is preserved for regular paginated callers, and the server-side `q`/`sortBy`/`sortDir`/`active`/`page`/`pageSize` capabilities remain intact for API consumers.
- Tests: `backend/tests/products.test.js` grew from 30 → 31 tests (new `pageSize=all` test asserting the full list with `totalPages: 1` and `hasMore: false`).

Task (Frontend):
- Rewrote `frontend/src/pages/ProductsPage.jsx` around a single fetch:
  - `loadProducts()` issues exactly one `GET /products?pageSize=all` on mount and after create/edit/deactivate mutations, storing the whole catalog in `allProducts` state
  - `filteredProducts` is a `useMemo` that applies the search query (name OR code, case-insensitive), the active/inactive status filter, and the sort (name/code/prices/PV, asc/desc) in-memory
  - The page count line reflects the **filtered** result length, not the server total
  - **Infinite scroll is now client-side slicing**: `visibleCount` starts at 20 and the IntersectionObserver sentinel just reveals 20 more rows from the in-memory list (`slice(0, visibleCount)`) — no network request, no loading spinner
  - Filter changes reset `visibleCount` back to 20 so the top of the filtered result is shown immediately
  - Empty state still distinguishes "Nenhum produto encontrado para os filtros aplicados." from "Nenhum produto cadastrado"
- Tests: `frontend/tests/ProductsPage.test.jsx` grew from 20 → 23 tests (search by name and by code without new API calls, active/inactive status filter without new API calls, PV-asc and name-desc sorting without new API calls, filtered empty state, in-memory infinite scroll reveal, no reveal when the filtered list fits one page, create/edit/deactivate flows unchanged)

Key Design Decisions:
- One network round-trip for the whole catalog (~219 rows) is cheap; per-keystroke requests are not. The API refetches only on mutations (create/edit/toggle) so the in-memory list reflects server state
- `useMemo` keeps filtering/sorting O(n) and only recomputes when inputs change
- Client-side slicing (not rendering all rows) preserves the Phase 29 DOM-perf win while eliminating the loading-more UX
- The backend keeps its full server-side search/sort/pagination API for other consumers; `pageSize=all` is the dedicated "give me everything" knob

Deliverable: ✅ Load-once catalog with client-side search/sort/status filter and in-memory infinite scroll — 129 backend tests (128 + 1 new), 210 frontend tests (207 + 3 new), 339 total tests

## 🎯 Phase 31: Order Item Sub-Form — Product, Charged Value, PV & Details
Status: ✅ COMPLETED

Context: The user wants to add richer information when inserting order items and a specific field order per item. Items are now linked to the product catalog, carry a member-price snapshot, an editable "charged value" (negotiated price), a PV snapshot, and free-text details (up to 500 chars).

Stack: Express, Prisma ORM, React, Tailwind CSS, Zod, client-side combobox.

Task (Backend):
- `Item` model rework in `backend/prisma/schema.prisma` (migration `20260811190000_extend_item_fields`):
  - `value` renamed to `chargedValue` (the effective negotiated price; `Order.totalValue` now sums it)
  - New nullable fields: `memberPrice`, `pv`, `details VARCHAR(500)` and `productId` (FK → `Product`, `ON DELETE SET NULL`)
  - `description` is now nullable (auto-filled from the selected product name client-side)
  - `Product` gained a back-reference `items Item[]`
- `backend/src/controllers/ordersController.js`:
  - `itemSchema` extended: `chargedValue` (required, `min(0).default(0)` — zero accepted for gifts/free items, missing field defaults to 0; negative still rejected), `productId` (optional UUID/nullable), `memberPrice`/`pv` (optional, non-negative), `details` (max 500), `description` (optional/nullable)
  - New `validateProducts(items)` helper — when a `productId` is provided it must exist **and** be active; otherwise 400 `One or more products not found`
  - `itemCreateData()` maps the new fields through create/update/addItem; `totalValue` computed from `chargedValue`; GET/GET by ID/POST/PUT responses now `include: { product: true }`
  - `updateItem` re-evaluates order total on `chargedValue` change (was `value`); `deleteItem` decrements by `chargedValue`
- `backend/src/controllers/paymentsController.js` + `dashboardController.js`: sums switched from `item.value` → `item.chargedValue`
- Tests: `backend/tests/orders.test.js` updated to `chargedValue` and grew 27 → 39 tests (product create/snapshot/details, standalone item without product, non-existent + inactive product rejection, >500 details rejection, item update with product fields, zero/gift item, missing-`chargedValue` defaulting to zero). `payments.test.js` & `dashboard.test.js` seed fields renamed. **129 → 146 backend tests.**

Task (Frontend):
- `frontend/src/pages/OrdersPage.jsx` reworked:
  - Per-item field order now: **Pessoa → Produto (combobox) → Valor Membro (read-only) → Valor Cobrado (editable) → PV (read-only) → Detalhes (textarea, 500 chars)**. The old free-text "Descrição"/"Valor" fields are gone; `description` is auto-filled from the selected product name
  - New `ProductCombobox` component: load-once catalog fetch (`GET /products?active=true&pageSize=all` in parallel with orders/people), client-side name/code filter, dropdown listing name + code + member price, and a **"Limpar produto"** button to unlink the item (clears the product and its snapshot fields). Dropdown uses `z-[70]` above the modal backdrop (`z-[60]`)
  - Selecting a product auto-fills `memberPrice` and `pv` (read-only inputs); `chargedValue` stays editable
  - `calculateTotal()`, create/edit validation and POST/PUT payloads use `chargedValue`; the **Valor Cobrado** field may be left empty (treated as 0 — gift/brinde); only **negative** values are rejected; details shown with a live `N/500` character counter
  - Edit modal pre-fills product combobox, member price, PV and details from the order items
- Tests: `frontend/tests/OrdersPage.test.jsx` grew 24 → 54 tests (combobox rendering + name filtering, member price/PV auto-fill, Limpar produto clear, payload assertions for productId/chargedValue/memberPrice/pv/details and for standalone items, details counter, empty-`chargedValue` treated as 0, zero-`chargedValue` gift, negative rejection, edit pre-fill of product + snapshot fields, update payload). **210 → 240 frontend tests.**

Key Design Decisions:
- `chargedValue` replaces `value` on the Item row — payments, dashboard, order totals and Excel exports stay consistent by reading a single monetary field
- `chargedValue` accepts **zero** (gift/brinde items) and the UI may be left **empty** (treated as 0); only negative values are rejected. The backend Zod schema uses `min(0).default(0)` so even a missing field defaults to zero — robust against direct API consumers
- `memberPrice`/`pv` are **snapshots** captured when the item is saved, so historical orders don't change when the catalog's current price window moves (financial consistency)
- `productId` is **optional** — standalone items (frete, taxa) and legacy orders remain valid; the UI shows "—" for absent member price/PV
- Matching Phase 30, the product combobox loads the catalog once and filters client-side — no per-keystroke API calls
- The combo dropdown exists above the modal (`z-[70]`) following the documented `z-index` hierarchy (nav → modals → toasts/dropdowns)

Deliverable: ✅ Enhanced order item sub-form with product linking, snapshots, negotiated charge and details — **146 backend tests (129 + 17 new), 240 frontend tests (210 + 30 new), 386 total tests**

## 🎯 Phase 32: Order Descriptive Fields — Tracking Link, Account Owner, Payment Type & Notes
Status: ✅ COMPLETED

Context: The user wants to enrich the order form with descriptive (non-financial) order-level fields: the dōTERRA order number must show a clickable tracking link to `https://status.ondeestameupedido.com/tracking/22747/{numero}/`, plus a free-text field for the account owner (dōTERRA ID or name), the payment method used (PIX, Boleto, Cartão de Crédito), a free-text order description (motivo do pedido, promoções, encomendas, etc.), and a live summary of the summed product value and summed PV placed before the items section.

Stack: Express, Prisma ORM, React, Tailwind CSS, Zod, lucide-react.

Task (Backend):
- `backend/prisma/schema.prisma` (migration `20260811193000_add_order_descriptive_fields`):
  - New enum `PaymentType` (`PIX` | `BOLETO` | `CARTAO_CREDITO`)
  - `Order` gained three nullable fields: `accountOwner VARCHAR(120)`, `paymentType PaymentType?`, `orderNotes VARCHAR(500)` — all optional so existing orders stay valid
- `backend/src/controllers/ordersController.js`:
  - `createOrderSchema`/`updateOrderSchema` extended with `accountOwner` (max 120), `paymentType` (Zod enum `['PIX','BOLETO','CARTAO_CREDITO']`) and `orderNotes` (max 500) — all optional/nullable
  - `createOrder` persists the three fields; `updateOrder` persists them in both branches (with items and metadata-only), using the `!== undefined` spread pattern so an explicit `null` clears a field while an omitted field keeps the existing value
  - `totalValue` remains computed server-side from `chargedValue` (financial consistency rule)
- Tests: `backend/tests/orders.test.js` grew 33 → 42 tests (create with all fields, nullable defaults, each valid payment type, invalid payment type rejection, >120 accountOwner rejection, >500 orderNotes rejection, update descriptive fields, explicit-null clearing, update-with-items preserving descriptive fields). **135 → 144 backend tests.**

Task (Frontend):
- `frontend/src/pages/OrdersPage.jsx`:
  - New top-level states `accountOwner`, `paymentType`, `orderNotes` wired into `resetForm()`, `handleEditOrder()` (pre-fill), and both POST/PUT payloads (empty values sent as `null`)
  - New helpers `trackingUrl(orderNumber)` (builds the tracking link with `encodeURIComponent`), `calculateTotalPV()` (sum of item `pv`), `paymentTypeLabel`/`paymentTypeBadge` (list rendering)
  - Form field order above the items: **Número do Pedido (new placeholder "Informe o número do pedido da dōTERRA" + "Ver pedido no site" tracking link shown once the field is blurred with a number typed) → Responsável pela conta (ID dōTERRA ou nome, max 120) → Data do Pedido → Tipo de Pagamento (select: PIX / Boleto / Cartão de Crédito) → Descrição do Pedido (textarea, 500 chars, live `N/500` counter) → Soma dos Produtos (Valor Cobrado) + Soma dos PV summary cards → Itens do Pedido**
  - The old post-items "Valor Total" block was removed (replaced by the summary cards above the items)
  - Orders list table grew columns: **Responsável, Tipo Pgto (badge), PV Total, Descrição (truncated with tooltip), Rastreio (external-link icon "Ver" opening the tracking URL in a new tab)**
- Tests: `frontend/tests/OrdersPage.test.jsx` grew 35 → 52 tests (renders of the three new fields, payment options, notes counter, tracking link shown/hidden, summary totals updating with item values, create payload with descriptive fields, null-for-empty payload, edit pre-fill + update payload, and the five new list columns). **221 → 238 frontend tests.**

Key Design Decisions:
- `accountOwner` is free text (not linked to a Person) — the user explicitly requested typing either the dōTERRA ID or the name
- `paymentType` is an Order-level enum describing how the client paid the dōTERRA order — it is **not** related to the `Payment` table (which tracks internal settlements against the order balance)
- The PV sum and product sum are computed dynamically in the UI — they are **not persisted** (the order total is already stored as `totalValue`)
- The tracking link uses `encodeURIComponent` on the raw number (no strict format validation, per user request) and appears once the order-number field loses focus (blur) with a non-whitespace number typed

Deliverable: ✅ Order form and list enriched with descriptive fields + tracking link — **144 backend tests (135 + 9 new), 238 frontend tests (221 + 17 new), 382 total tests**

## 🎯 Phase 33: Zero/Gift Charged Value (Empty = 0)
Status: ✅ COMPLETED

Context: Some order items are gifts (brindes). The Valor Cobrado field should accept zero, and the user should not be forced to type `0` — leaving the field empty should default to zero. Negative values must still be rejected.

Stack: Express, Zod, React.

Task (Backend):
- `backend/src/controllers/ordersController.js`: `itemSchema.chargedValue` changed from `z.number().positive()` to `z.number().min(0).default(0)` — zero is accepted, a missing field defaults to 0 (robust for direct API consumers), negatives still rejected with `Charged value must not be negative`.
- Tests: `backend/tests/orders.test.js` added `should default missing chargedValue to zero` and `should allow order with zero charged value (free item / gift)`. The pre-existing `should reject order with invalid item value (negative)` continues to pass. Orders tests 42 → 44. **144 → 146 backend tests.**

Task (Frontend):
- `frontend/src/pages/OrdersPage.jsx`:
  - `itemPayload()` converts empty/null `chargedValue` to `0` before sending
  - create/update validations only reject **negatives** (`< 0`); an empty Valor Cobrado is valid
  - Valor Cobrado input keeps `min="0"` and placeholder `0.00` (no `required` attribute)
- Tests: `frontend/tests/OrdersPage.test.jsx` replaced `should show validation error when charged value is empty` with `should allow empty charged value (assumed zero)` (asserts payload `chargedValue: 0`) and added `should reject negative charged value`. Added `should allow zero charged value (free item / gift)`. OrdersPage tests 52 → 54. **238 → 240 frontend tests.**

Key Design Decisions:
- Empty-as-zero is enforced in **both** the frontend payload conversion and the backend Zod `default(0)`, so the contract holds even for direct API calls
- Zero-value items flow through unchanged payment/dashboard totals logic (sums include 0) — gifts correctly contribute nothing to the order total

Deliverable: ✅ Valor Cobrado aceita zero e vazio (assume 0) para brindes; negativo continua rejeitado — **146 backend tests (144 + 2 new), 240 frontend tests (238 + 2 new), 386 total tests**

## 🎯 Phase 34: Receivables Adjustments — "Dar baixa" for R$ 0,00 items & Overpayment Acceptance
Status: ✅ COMPLETED

Context: The user needs two adjustments in the "Registrar Pagamento" modal of the Recebíveis screen. (1) Since an order item can now have `chargedValue = 0,00` (gifts/brindes/descounts), that person's item must appear in the list, show that there is nothing to receive ("Nada a receber"), and still allow registering a payment of R$ 0,00 to formally settle it. (2) The user may legitimately receive amounts **larger** than the expected pending balance (e.g. an item charged at R$ 19,90 can be settled with R$ 20,00 or more after a later negotiation) — overpayment must no longer be rejected.

Stack: Express, Zod, React, Vitest.

Task (Backend):
- `backend/src/controllers/paymentsController.js`:
  - `paymentSchema.amount` changed from `z.number().positive()` to `z.number().nonnegative()` — a R$ 0,00 payment is now accepted; negatives are still rejected (Zod)
  - `createPayment` removed both guardrails: the `amountCents <= 0` rejection and the `amountCents > pendingCents` ("Amount exceeds pending balance") overpayment rejection — any non-negative amount is recorded **as long as it's a zero-value person** (see guard below)
  - **Refined zero-amount guard**: `itemSumCents` is recomputed for the person; if `itemSumCents > 0 && amountCents === 0` the request is rejected with `'Amount must be greater than zero for a person with chargeable items'` (400) — R$ 0,00 is only accepted for genuinely gift/brinde persons (`itemSumCents === 0`)
  - The status engine already handles both cases correctly with `personPendingCents > 0`: an overpaid (`personPendingCents < 0`) or settled (`= 0`) person no longer blocks `allPaid`; a zero payment leaves `hasAnyPayment` false, so a mixed order (one person R$ 0,00 settled + another still owing) stays `PENDENTE` until real money is received
  - `getOrderBalance` unchanged: `pending` still clamps with `Math.max(0, ...)` so an overpaid person reports `pending = 0` (never negative), while `paymentTotal` reflects the actual received amount
- Tests: `backend/tests/payments.test.js`:
  - Reworked: overpayment now returns `201` + `QUITADO` (single-person), overpayment on a multi-person order stays `PARCIAL` while others owe, zero-amount for a zero-value item returns `201` + `QUITADO`, cents-based overpayment (`1233,00` + `1,57` on `1234,56`) is accepted with `pending = 0` and `paymentTotal = 1234,57`, and the former transaction-rollback test now asserts overpayment **persists** with order `QUITADO`
  - Added: mixed order test (R$ 0,00 person + R$ 100,00 person) — zero "baixa" registers a `0` payment, keeps the order `PENDENTE`, and both pending balances stay correct; plus a guard test `should reject zero payment when the person has chargeable items` (post `amount: 0` for a R$ 150,00 person → `400` with `'greater than zero'`)
  - Payments tests 28 → 31. **146 → 149 backend tests.**

Task (Frontend):
- `frontend/src/pages/ReceivablesPage.jsx`:
  - `openPaymentModal` no longer filters out persons with `pending = 0` — **every** person of the order is listed; when the first selected person has `itemTotal === 0` (gift) the amount input is pre-filled with `0`
  - Person dropdown shows `— Nada a receber` for **zero-item persons** (driven by `toCents(b.itemTotal) === 0`, not `pending`); the balance info box shows "Nada a receber — baixa sem valor"; a fully-paid person (`itemTotal > 0` but `pending = 0`) shows "Pendente: R$ 0,00" and requires an amount > 0
  - Amount input now has `min="0"` (was `min="0.01"`) and is disabled when a zero-item person is selected; the submit button reads **"Dar baixa"** in that case
  - `handlePaymentSubmit` accepts `amount = 0` **only** for zero-item persons (`isSelectedZeroItem()`); for a person with `itemTotal > 0` an amount of `0` shows "Valor deve ser maior que zero" and blocks the POST. Negatives are rejected with "Valor não pode ser negativo". The `amount > pending` rejection was removed and a `window.confirm` step added: an amount exceeding the pending balance asks "Valor de R$ X é maior que o saldo pendente (R$ Y). Confirmar recebimento?" — the payment is only submitted after the user confirms (also fires for fully-paid persons receiving more, since `pending = 0`)
- Tests: `frontend/tests/ReceivablesPage.test.jsx`:
  - Reworked: removed "Nenhuma pessoa com saldo pendente"/zero-rejection/overpayment-rejection tests
  - Added: zero-balance persons appear as "Nada a receber" in the dropdown, the "Dar baixa" button is shown and submits a `R$ 0,00` payment, a zero amount submits successfully (zero-item), overpayment shows the `window.confirm` prompt and POSTs when confirmed, and does not POST when cancelled; plus a **guard test** rejecting `0` against a positive balance ("Valor deve ser maior que zero", no POST)
  - ReceivablesPage tests 27 → 30. **240 → 243 frontend tests.**

Key Design Decisions:
- The zero-value "baixa" is recorded as a real `Payment` row of R$ 0,00 (audit history), though it does not change the person's balance
- R$ 0,00 payments are accepted **only** when the person's `itemSum === 0` (gift items); for a person with chargeable items, an amount strictly greater than zero is required — both backend (`itemSumCents > 0 && amountCents === 0` rejection) and frontend (validation guard with 'Valor deve ser maior que zero') enforce the rule, so an accidental zero against a positive balance cannot create a useless record
- Overpayment is intentionally **unbounded** on the backend (any amount ≥ 0 for zero-item persons, any amount > 0 for chargeable persons) — the frontend `window.confirm` is the only gate, keeping a single source of truth (server accepts overpayment) and avoiding "double validation" drift
- Order status semantics are preserved: `QUITADO` requires every person settled; a zero-person alone cannot move a mixed order past `PENDENTE`, and overpayment never produces a negative "pending" (clamped at 0)
- Dashboard per-person `pending` already clamps at 0 and `totalPaid` uses the order total (not the payment sum), so overpayment is not double-counted as revenue

Deliverable: ✅ "Dar baixa" de R$ 0,00 para brindes + pagamento com overpayment confirmado (com regra anti-zero para pessoas com itens cobráveis) — **149 backend tests (146 + 3 new), 243 frontend tests (240 + 3 new), 392 total tests**

## 🎯 Phase 35: Custom Overpayment Confirmation Dialog

Status: ✅ COMPLETED

Context: The overpayment confirmation used the browser's native `window.confirm`, which looks nothing like the rest of the application. The user wants an in-app HTML confirmation dialog styled like the other modals (white/dark cards, gradient primary button, gray cancel button), replacing the native browser dialog.

Stack: React, Tailwind CSS, lucide-react, Vitest.

Task (Frontend):
- `frontend/src/components/ConfirmDialog.jsx` (**new**): reusable custom confirmation dialog with props `open`, `title`, `message` (accepts React nodes, so amounts can be wrapped in `<strong>`), `confirmLabel` (default `'Confirmar'`), `cancelLabel` (default `'Cancelar'`), `onConfirm`, `onCancel`, `loading`. Overlay `fixed inset-0 z-[70]` with `bg-black/50` (same hierarchy as the onboarding tour, above the payment modal's `z-[60]`), centered card `bg-white dark:bg-gray-800 rounded-xl shadow-2xl`, amber `AlertTriangle` icon in a `rounded-full` circle, PT-BR copy, gradient `from-primary-700 to-primary-500` confirm button, gray cancel button (same styles as the payment modal buttons), `role="dialog"` + `aria-modal="true"`, auto-focus on the confirm button, Escape key and backdrop-click to cancel (both disabled while `loading`)
- `frontend/src/pages/ReceivablesPage.jsx`:
  - The POST logic was extracted from `handlePaymentSubmit` into a `submitPayment()` helper (unchanged behavior — same payload, toast feedback and error mapping)
  - `handlePaymentSubmit` now **shows the dialog** (`setShowOverpayConfirm(true)`) when `amountCents > pendingCents` instead of calling `window.confirm`; the payment is only posted after the user confirms in the dialog
  - A `<ConfirmDialog open={showOverpayConfirm} ...>` renders next to the payment modal with title **"Confirmar recebimento"**, the message "Valor de **R$ X** é maior que o saldo pendente (**R$ Y**). Deseja mesmo confirmar este recebimento?" (amounts bolded via `<strong>`), `confirmLabel="Confirmar recebimento"` and `cancelLabel="Cancelar"`; `onConfirm` closes the dialog and calls `submitPayment()`, `onCancel` only closes it
- Tests: `frontend/tests/ReceivablesPage.test.jsx`:
  - Removed all `window.confirm` mocking (`beforeEach` no longer stubs it; the zero-balance and overpayment tests no longer set `window.confirm`)
  - Reworked: the overpayment tests now assert the dialog is rendered (`screen.findByRole('dialog')`, scoped assertions with `within(dialog)` for the message and the BRL amounts) and click its **"Confirmar recebimento"** button to confirm / **"Cancelar"** button to abort; the cancelled test also asserts the dialog closes with no POST
  - Added: `should not show the overpayment confirmation when amount equals the pending balance` — a full-settlement amount (R$ 300,00 on a R$ 300,00 pending) posts directly without rendering the dialog
  - ReceivablesPage tests 30 → 31. **243 → 244 frontend tests.**

Key Design Decisions:
- The `ConfirmDialog` is a standalone reusable component so future confirmation flows (deletes, destructive actions, etc.) can adopt it instead of `window.confirm`
- `message` accepts React nodes so monetary values are emphasized with `<strong>` inside the sentence
- z-index `z-[70]` matches the onboarding tour and stays above the payment modal (`z-[60]`), keeping the modal visible behind the dialog as context
- The overpayment rule is unchanged (still unbounded on the backend); the custom dialog is purely a UI replacement of the previous `window.confirm` gate

Deliverable: ✅ Confirmação de overpayment em HTML no visual da aplicação (componente reutilizável `ConfirmDialog`) substituindo o `window.confirm` nativo — **149 backend tests (inalterados), 244 frontend tests (243 + 1 new), 393 total tests**

## 🎯 Phase 36: Cadastro de Clientes — Rename + WhatsApp/Instagram/Endereço/VIP/Membro doTERRA

Status: ✅ COMPLETED

Context: The user wants to enrich the client (Pessoa) registration. The menu option is renamed to "Cadastro de Clientes" and the form gains, in order: **Nome**, **Grupos em comum** (free-text category describing where the client came from — WhatsApp group, neighbor, family, etc.), **WhatsApp** (phone number that becomes a `https://wa.me/{numero}` link when viewed in the table; the field comes pre-filled with Brazil's country code `55` and stays editable), **Instagram** (link), a **single Endereço** field, **Grupo VIP** (Sim/Não) and **Cadastrado/Membro doTERRA** (Sim/Não). The legacy `contact` field is migrated into `whatsapp` preserving data; out-of-pattern values (e.g. old e-mails) are kept, flagged with a non-blocking inline warning, and can still be saved.

Stack: Express, Prisma ORM, React, Tailwind CSS, Zod, lucide-react, Vitest.

Task (Backend):
- `backend/prisma/schema.prisma` (migration `20260812151032_extend_person_client_fields`):
  - `Person.contact` renamed to `Person.whatsapp` — the generated migration would have been `DROP COLUMN contact` (data loss), so it was **hand-edited to `ALTER TABLE "Person" RENAME COLUMN "contact" TO "whatsapp"`** preserving every existing value (lesson #22)
  - New nullable fields: `commonGroups VARCHAR(255)`, `instagram VARCHAR(255)`, `address VARCHAR(500)`, plus `isVip Boolean NOT NULL DEFAULT false` and `isDoterraMember Boolean NOT NULL DEFAULT false` (both default `false`, so existing rows read "Não")
- `backend/src/controllers/peopleController.js`: `personSchema` extended — `whatsapp` (string, nullable), `commonGroups`/`instagram` (string ≤255, nullable), `address` (string ≤500, nullable), `isVip`/`isDoterraMember` (boolean, optional — omitted defaults to `false` on create)
- Tests: `backend/tests/people.test.js` reworked + grew 17 → 26 tests: all-fields create, optional-fields defaulting to null/false, legacy non-digit whatsapp preserved, >255 `commonGroups`/`instagram` rejection, >500 `address` rejection, non-boolean `isVip` rejection, GET by id returns all fields, update all client fields, explicit-null whatsapp clearing, non-boolean `isDoterraMember` rejection. **149 → 158 backend tests.**

Task (Frontend):
- `frontend/src/utils/whatsapp.js` (**new**): `onlyDigits` (strips non-digits, caps at 15 — E.164 max), `isDigitsOnly`, `isWhatsAppOutOfPattern` (10–15 digits; empty = ok; covers BR `55 + DDD + 8/9` and international), `maskWhatsApp` (progressive `+55 (11) 99999-8888`, handles 8-digit landlines and 9-digit mobiles), `whatsAppLink` (returns `https://wa.me/{digits}` or `null` when out of pattern)
- `frontend/src/pages/PeoplePage.jsx` reworked:
  - Title "Cadastro de Clientes", empty state "Nenhum cliente cadastrado", modals **"Novo Cliente"/"Editar Cliente"**, PT-BR error messages use "cliente"
  - Form field order: Nome (required) → Grupos em comum → WhatsApp → Instagram → Endereço → Grupo VIP (Sim/Não select) → Cadastrado/Membro doTERRA (Sim/Não select). The shared `PersonFormFields` component avoids duplicating the 7 fields across the two modals; modals gained `max-h-[90vh] overflow-y-auto`
  - WhatsApp input: `type="tel"` + `inputMode="numeric"`, pre-filled `+55` on create, masks as the user types; onChange stores **digits only**; an **inline amber out-of-pattern warning** (AlertTriangle icon, dark-mode aware, non-blocking) shows when the value is non-empty and has <10 or >15 digits — legacy non-digit values (old e-mails) display raw with the warning and remain saveable (no native alerts)
  - Payload: `whatsapp` sent as digits; untouched legacy raw values are preserved as-is; empty → `null`; booleans sent as-is
  - Table columns: Nome | Grupos em Comum | **WhatsApp** (masked + `https://wa.me/{digits}` link, `target="_blank"`; out-of-pattern values render as plain text) | **Instagram** (clickable link with auto `https://` prefix) | Endereço | **VIP** (Sim/Não badge) | **Membro doTERRA** (badge) | Ações
- `frontend/src/components/Header.jsx` + `MobileDrawer.jsx`: nav label "Pessoas" → **"Clientes"** (route `/people` unchanged)
- `frontend/src/components/OnboardingTour.jsx`: step renamed "Cadastro de Clientes" with the new fields explained; intro text updated to "clientes"
- `frontend/src/utils/exportExcel.js`: sheet "Pessoas" renamed to **"Clientes"** with headers Nome, Grupos em Comum, WhatsApp, Instagram, Endereço, VIP, Membro doTERRA (WhatsApp exported formatted via `maskWhatsApp`, VIP/Membro as Sim/Não)
- Tests: `frontend/tests/PeoplePage.test.jsx` reworked + grew 14 → 23 tests (new title, wa.me link rendering, plain-text legacy whatsapp, instagram link, Sim/Não badges, `+55` pre-fill, mask while typing, out-of-pattern warning shown/hidden, all-fields create payload, edit pre-fill incl. masked whatsapp, legacy raw + warning on edit, update payload); `exportExcel.test.js` reworked (Clientes sheet headers/rows/nulls/widths); `Header.test.jsx` + `MobileDrawer.test.jsx` updated to "Clientes". **244 → 253 frontend tests.**

Key Design Decisions:
- The `contact` → `whatsapp` rename is a **real column rename** (data preserved) rather than drop+add — Prisma's default migration would have destroyed every existing contact value
- WhatsApp is stored **digits-only** (≤15) and displayed with the mask; the pre-filled `+55` is part of the stored number, so editing never loses the country code unless the user deliberately changes it (foreign numbers supported — the warning is informational, never blocking)
- Out-of-pattern values are **warned but saveable** (both new and legacy), per user request — an inline amber notice replaces any native `window.confirm`/`alert`; the `wa.me` link only renders for values matching 10–15 digits
- Sim/Não selects store booleans (`isVip`, `isDoterraMember`) with DB default `false`; the `<select>` uses string values `'true'/'false'` because React does not match boolean `value` against option strings
- Route and API paths stay `/people` + `/api/people` (internal artifacts remain English); only user-facing PT-BR labels changed

Deliverable: ✅ Cadastro de Clientes com WhatsApp (link wa.me + máscara + aviso fora do padrão), Instagram, Endereço, VIP e Membro doTERRA — **158 backend tests (149 + 9 new), 253 frontend tests (244 + 9 new), 411 total tests**

## 🎯 Phase 37: Recebíveis — Lista com paridade à Gestão de Pedidos

Status: ✅ COMPLETED

Context: A lista do **Controle de Recebíveis** mostrava apenas Número, Valor Total, Status e Ações. O cliente pediu colunas semelhantes às da **Gestão de Pedidos** — número, data, responsável, valor total do pedido, valor pendente, PV Total, descrição, status e ações (excluindo "Tipo Pgto" e "Rastreio", conforme confirmado).

Stack: React, Tailwind CSS, Vitest, React Testing Library.

Task:
- `frontend/src/utils/dates.js` (**novo**): extrai `formatDateBR` (PT-BR `dd/mm/yyyy`) que estava duplicado localmente em `OrdersPage.jsx`, reutilizado por ambas as páginas (DRY).
- `frontend/src/pages/ReceivablesPage.jsx`: tabela ampliada para 9 colunas — **Número | Data | Responsável | Valor (R$) | Valor Pendente | PV Total | Descrição | Status | Ações**.
  - **Valor Pendente** calculado client-side: `max(0, totalValue − Σ payments[].amount)` em centavos (nada de backend novo — `GET /api/orders` já retorna `payments[]`). Overpayment (Σ pagamentos > total) é **fixado em R$ 0,00**; o badge de status comunica o estado real.
  - **PV Total** = `Σ items[].pv` (mesma fórmula do Orders).
  - **Descrição** truncada com `title` completo; `—` quando vazia.
  - Ações permanece **Registrar Pagamento** / **Pago** (sem Editar/Excluir numa lista de recebíveis).
- Tests: `frontend/tests/ReceivablesPage.test.jsx` cresceu 31 → 40 (mocks ampliados com `orderDate`, `accountOwner`, `orderNotes`, `items[].pv`, `payments[].amount` + 9 novos testes: data em BR, responsável/`—`, pendente = total sem pagamentos, pendente = total − pago, pendente fixado em 0 no overpayment, PV Total, descrição truncada + `title`, `—` para descrição vazia).

Key Design Decisions:
- Nenhuma mudança de backend: `GET /api/orders` já inclui `items[]` (com `pv`) e `payments[]` por pedido; o pendente é derivado client-side, sem chamada extra.
- Pendente em centavos inteiros (`toCents`) e clampado em `Math.max(0, ...)` para nunca exibir valor negativo em overpayment.
- "Tipo Pgto" e "Rastreio" foram **omitidos** intencionalmente (pedido explícito do cliente).

Deliverable: ✅ Lista do Controle de Recebíveis espelhando a Gestão de Pedidos com Valor Pendente calculado — **158 backend tests (sem alterações), 262 frontend tests (253 + 9 new), 420 total tests**

## 🎯 Phase 38: Registrar Pagamento — Cabeçalho do Pedido + Itens por Pessoa

Status: ✅ COMPLETED

Context: O modal **Registrar Pagamento** mostrava apenas a pessoa selecionada com seu saldo pendente. O cliente precisava cruzar informações com controles externos (planilhas próprias, sistema da dōTERRA) para identificar **quais itens** uma pessoa comprou e **quanto** foi cobrado antes de lançar o pagamento. O modal ganhou um **cabeçalho com os dados básicos do pedido** (sempre visível) e uma **lista de itens da pessoa selecionada** (descrição do produto, valor cobrado e detalhes).

Stack: React, Tailwind CSS, Vitest, React Testing Library.

Task:
- `frontend/src/pages/ReceivablesPage.jsx`:
  - **Cabeçalho do pedido** (grid 2 colunas, acima do select de Pessoa) com 6 campos: **Número**, **Data** (`formatDateBR`), **Responsável** (`accountOwner`, `—` quando vazio), **Valor Total**, **Valor Pendente** e **Descrição** (`orderNotes` truncada com `title`, `—` quando vazia). O **Valor Pendente** é calculado client-side em centavos como `max(0, totalValue − Σ payments[].amount)` — fixado em R$ 0,00 quando a soma dos pagamentos iguala ou supera o total.
  - **Lista de itens da pessoa** (abaixo do callout "Saldo pendente"/"Nada a receber", apenas quando `selectedPersonId` está setado): filtra `selectedOrder.items` por `personId`, e para cada item mostra **descrição** (nome do produto), **valor cobrado** (`formatBRL(parseFloat(item.chargedValue))`) e **detalhes** (`item.details`, `—` quando nulo). Pessoa sem itens exibe "Nenhum item registrado para esta pessoa".
  - Modal alargado de `max-w-md` para `max-w-lg` com `max-h-[90vh] overflow-y-auto` no painel para rolar listas longas.
- Tests: `frontend/tests/ReceivablesPage.test.jsx` cresceu 40 → 51 (mocks enriquecidos com `paidOrder`/`overpaidOrder`/`richOrder` com `items[].{description,details,chargedValue,personId}` + 11 novos testes: labels do cabeçalho, valores (número/data/responsável/descrição), pendente = total sem pagamentos, pendente = 0 quando totalmente pago, pendente = 0 no overpayment, `title` na descrição, `—` para descrição ausente, lista de itens da pessoa, `—` para item sem detalhes, itens de outras pessoas não aparecem, troca de pessoa filtra a lista).

Key Design Decisions:
- **Nenhuma mudança de backend**: `GET /api/orders` já retorna `items[]` (com `description`/`details`/`chargedValue`) e `payments[]`; o cabeçalho e a lista de itens são derivados client-side do objeto `selectedOrder` já carregado — sem chamada extra nem migração.
- O **Valor Pendente do cabeçalho** é o pendente **do pedido inteiro** (total − soma de todos os pagamentos), distinto do pendente **por pessoa** exibido no callout/seletor — ambos em centavos inteiros com `Math.max(0, ...)`.
- Foram usados `data-testid`s (`payment-modal`, `order-summary-total`, `order-summary-pending`, `order-summary-description`) para tornar as asserções robustas contra textos repetidos (ex.: "R$ 300,00" aparece no cabeçalho, no select e no callout).

Deliverable: ✅ Modal de Registrar Pagamento com cabeçalho do pedido e itens por pessoa — **158 backend tests (sem alterações), 273 frontend tests (262 + 11 new), 431 total tests**

## 🎯 Phase 39: Status "Indisponível" + Link do Site no Produto

Status: ✅ COMPLETED

Context: A lista de produtos só distinguia **Ativo** e **Inativo** (campo `active: Boolean`) e não tinha como guardar o link da página do produto no site da dōTERRA. O cliente pediu (1) um campo para colar o **link do produto no site da dōTERRA** e (2) um terceiro status **"Indisponível"** — que indica que o produto saiu do site mas ainda pode estar em pedidos antigos. Regra de pedidos: apenas produtos **Inativo** não podem ser escolhidos na inclusão/edição; **Indisponível** continua selecionável. Pedido que já contém um produto inativo deve mostrar o nome/código na edição, mas sem oferecer esse produto na lista de troca.

Stack: Node.js/Express, Prisma, PostgreSQL, React, Tailwind CSS, Vitest, React Testing Library.

Task:
- Backend (`schema.prisma` + migration `20260812160000_add_product_status_and_url`): substituir `Product.active: Boolean` por `status ProductStatus @default(ATIVO)` (enum **ATIVO / INDISPONIVEL / INATIVO**) e adicionar `doterraUrl String? @db.VarChar(2048)`. Migração backfill `active=true→ATIVO`, `active=false→INATIVO`, adiciona `doterraUrl`, troca índice `active` → `status`, dropa `active` — aplicada via `migrate deploy` (nenhum dado perdido).
- `productController.js`: `createProductSchema` ganha `doterraUrl` (`z.string().url().max(2048).optional().nullable()`); `updateProductSchema` troca `active` por `status` (enum) + `doterraUrl`; `projectCurrentPrice` expõe `status`/`doterraUrl`; `getProducts` aceita `?status=` (simples/múltiplo), **`?available=true`** → `status IN [ATIVO, INDISPONIVEL]` e mantém alias legado `?active=true/false`; `deleteProduct` soft-delete via `status = 'INATIVO'`.
- `ordersController.js`: `validateProducts` passa a exigir `status IN [ATIVO, INDISPONIVEL]` (erro `'One or more products are inactive or do not exist'`).
- `productLoader.js`: deactivation loop agora filtra `where: { status: 'ATIVO' }`; produtos `INDISPONIVEL` (estado manual) **nunca são tocados** — presentes no CSV preservam o status, ausentes não são desativados.
- Frontend `ProductsPage.jsx`: filtro e badge de status com 3 estados (Ativo verde / Indisponível âmbar com `AlertCircle` / Inativo cinza), campo **"URL do produto no site da dōTERRA"** nos modais de criar/editar (validação de URL), coluna **Site** (ícone `ExternalLink` abrindo em nova aba), dropdown inline de status substituindo Desativar/Ativar.
- Frontend `OrdersPage.jsx`: combobox passa a carregar `/products?available=true` (ATIVO + INDISPONIVEL); o `ProductCombobox` ganhou props `selectedName`/`selectedCode` para exibir o nome/código de um produto **INATIVO** já vinculado ao item (via `item.product` retornado por `GET /api/orders`), mantendo o botão "Limpar produto".
- Tests: backend `products.test.js` 31 → 38 (create com/`sem` doterraUrl, URL inválida, update status/doterraUrl/limpar-null, filtros `status=INDISPONIVEL` e `available=true`), `orders.test.js` (aceita INDISPONIVEL, rejeita INATIVO com nova mensagem), `productLoader.test.js` 16 → 18 (preserva INDISPONIVEL presente no CSV e ausente do CSV). Frontend `ProductsPage.test.jsx` 23 → 29 (badges 3 estados via `data-testid`, coluna Site, filtro INDISPONIVEL, URL inválida, `doterraUrl: null` no create, PUT com status+doterraUrl, dropdown inline), `OrdersPage.test.jsx` 54 → 57 (`available=true` na query, INDISPONIVEL listado, INATIVO exibido na edição via fallback).

Key Design Decisions:
- **Enum em vez de boolean**: `ProductStatus` expressa os 3 estados semanticamente (migração preserva 100% dos dados); o loader distingue estado manual (`INDISPONIVEL`) de estado derivado do catálogo (`ATIVO`/`INATIVO`).
- **`?available=true`** é o contrato de "selecionável em pedidos" (ATIVO + INDISPONIVEL), separado do filtro de gestão `?status=`.
- O fallback `selectedName`/`selectedCode` no combobox resolve a regra "produto inativo aparece na edição mas não na lista de troca" sem chamada extra — `GET /api/orders` já inclui `item.product`.

Deliverable: ✅ Status Indisponível + link do site no produto, com pedidos aceitando INDISPONIVEL e exibindo INATIVO apenas na edição — **168 backend tests (158 + 10 new), 282 frontend tests (273 + 9 new), 450 total tests**

## 🎯 Phase 40: Listas Responsivas com Flowbite (padrão `data-label`)

Status: ✅ COMPLETED

Context: Todas as listas (Clientes, Pedidos, Recebíveis, Produtos e a tabela "Resumo por Ano" do Dashboard) usavam `<div className="overflow-x-auto">` em volta de `<table className="min-w-full ...">` com células `whitespace-nowrap` — em telas estreitas isso criava **barra de rolagem horizontal**. O cliente pediu para eliminar as barras de rolagem horizontal sem uma refatoração grande, aceitando o uso de um framework/design system.

Stack: React, Tailwind CSS v3, **Flowbite** (`flowbite@^2.5.2`, plugin Tailwind apenas, MIT).

Task:
- Setup: adicionar `flowbite@^2.5.2` em `frontend/package.json`; em `tailwind.config.js` registrar `import flowbitePlugin from 'flowbite/plugin.js'` em `plugins` e incluir `./node_modules/flowbite/**/*.js` em `content` (ver lição #24 — o import precisa da extensão `.js`).
- Migrar as 5 tabelas (`PeoplePage.jsx`, `OrdersPage.jsx`, `ReceivablesPage.jsx`, `ProductsPage.jsx`, `DashboardPage.jsx`): remover `overflow-x-auto`; `<table>` → `block md:table`; `<thead>` → `hidden md:table-header-group`; `<tbody>` → `block md:table-row-group`; `<tr>` → `block md:table-row ... border rounded-lg shadow-sm mb-3 md:mb-0`; cada `<td>` → `block md:table-cell` + `data-label="Coluna"` + `before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase md:before:hidden`.
- Ajustes por célula: `whitespace-nowrap` virou `md:whitespace-nowrap`; colunas alinhadas à direita/centro viram `text-left md:text-right` / `text-left md:text-center`.
- Testes: **nenhum teste alterado** — a estrutura DOM (`<table>/<tr>/<td>`) é preservada; só mudaram classes/atributos. Os 282 testes frontend passam inalterados.

Key Design Decisions:
- **Só o plugin, sem JS**: Flowbite entra como plugin Tailwind puro (sem `flowbite/dist/flowbite.css`, sem componentes JS) para não inflar o bundle — o padrão `data-label` é puro CSS/Tailwind.
- **Padrão de cards mobile**: abaixo de `md` cada linha vira um card empilhado com o nome da coluna como rótulo acima do valor; todas as colunas continuam visíveis. Em `md+` a tabela fica idêntica à anterior.
- **Acessibilidade preservada**: o DOM continua `<table>/<tr>/<td>` reais — leitores de tela e testes que selecionam `tbody tr` continuam funcionando; o `<thead>` é apenas oculto visualmente em `<md`.

Deliverable: ✅ Zero barras de rolagem horizontal em qualquer largura (320px–1920px) nas 5 listas, mantendo todas as colunas visíveis no mobile via cards com rótulo — **168 backend tests, 282 frontend tests, 450 total tests (sem regressões, nenhum teste alterado)**

## 🎯 Phase 41: Action Menu Dropdown (kebab) na coluna AÇÕES de Pedidos

Status: ✅ COMPLETED

Context: A coluna `Ações` da tabela de Pedidos (e das outras listas) renderizava dois botões de texto lado-a-lado ("Editar" e "Excluir"), ocupando espaço visual e poluindo o cabeçalho. O cliente pediu para adotar o padrão de mercado com **menu de ações dropdown** (ícone kebab, menu `bottom-end` com ícone + texto, item Excluir com estilo de perigo). Decisão: implementar agora apenas em **OrdersPage** e produzir um guia de migração para que o próximo agente replique em Clientes/Recebíveis/Produtos.

Stack: React, Tailwind CSS, `lucide-react` (já provê `MoreVertical`, `Pencil`, `Trash`). Sem novas dependências.

Task:
- Criar `frontend/src/components/ActionMenu.jsx` — componente reutilizável (~80 linhas) que recebe `actions`, `ariaLabel` e `testIdPrefix`. Usa estado React (`useState` para `open`), click-outside via `mousedown` no `document`, fechamento por `Escape`. Renderiza:
  - Trigger: `<button type="button" aria-haspopup="menu" aria-expanded={open}>` envolvendo `<MoreVertical>` (`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-primary-500 transition-colors`).
  - Backdrop: `<div fixed inset-0 z-[70]>` com `data-testid` (clicar fecha).
  - Menu: `<div role="menu" absolute right-0 mt-2 z-[80] w-44 ... divide-y ... rounded-lg shadow-lg>` ancorado em `bottom-end` ao trigger.
  - Item `default`: `text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700`.
  - Item `danger`: `text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300`.
  - Cada item chama `e.stopPropagation()` e fecha o menu **antes** de invocar `onClick` (evita dropdown-fantasma atrás de modal recém-aberto).
- `OrdersPage.jsx`: substituir os dois botões inline por `<ActionMenu>` dentro de `<div className="flex justify-end">`. Adicionar `relative` ao `<td>` para ancoragem correta. Imports adicionais: `Pencil`, `Trash` (de `lucide-react`) e `ActionMenu` (de `../components/ActionMenu`). `handleEditOrder(order)` / `handleDeleteOrder(order.id)` ficam **intactos**.
- Testes (TDD): substituir `'should display Edit and Delete buttons for each order'` por `'should display an actions kebab trigger for each order'`; adicionar 7 novos testes para abertura/fechamento do menu, semântica ARIA, estilo danger do Excluir, fechamento por clique no backdrop, por `Escape` e após clicar em item. Reescrever os 9 testes existentes que dependiam de `getAllByText('Editar'|'Excluir')` para usar os helpers `openOrderActionsMenu(id)` e `clickOrderAction(id, label)` que abrem o menu primeiro.
- Documentação: criar `docs/ACTION_MENU_REFACTORING_GUIDE.md` (playbook de migração para People/Receivables/Products), atualizar `AGENTS.md` (entrada Phase 41) e `ROADMAP.md`.

Key Design Decisions:
- **Componente próprio em React + Tailwind (sem `flowbite-react`)**: nenhuma nova dependência; segue o padrão do `ProductCombobox` (state + backdrop + z-index). Bundle inalterado.
- **Z-index hierarchy** (lição #18): modais `z-[60]` · ConfirmDialog + ActionMenu backdrop `z-[70]` · ActionMenu panel `z-[80]`. O menu fica acima de qualquer modal aberto.
- **Acessibilidade**: trigger com `aria-haspopup="menu"` + `aria-expanded`; menu com `role="menu"`; itens com `role="menuitem"`. Funciona com teclado (Tab cicla, Escape fecha).
- **`data-testid`s determinísticos** (`<prefix>-trigger`, `<prefix>-menu`, `<prefix>-item-<label>`) eliminam ambiguidade em testes mesmo com múltiplos pedidos na mesma página.
- **`flex justify-end`** mantém o trigger alinhado à direita tanto no desktop (`lg:text-right` herdado) quanto no mobile (card `data-label` da Fase 40).
- **Migração guiada**: por decisão do cliente, só OrdersPage foi migrada nesta fase; Clientes/Recebíveis/Produtos têm guia pronto em `docs/ACTION_MENU_REFACTORING_GUIDE.md`.

Deliverable: ✅ Coluna `Ações` de Pedidos com menu kebab (`MoreVertical`) + dropdown `bottom-end` com Editar (ícone `Pencil`, default) e Excluir (ícone `Trash`, danger). Handlers `handleEditOrder(order)` e `handleDeleteOrder(order.id)` preservados. 7 novos testes TDD verdes. **168 backend tests, 289 frontend tests, 457 total tests (zero regressões)**

---

### 🎯 PHASE 42: Action Menu (kebab) em Clientes e Produtos

**Objetivo**: replicar o padrão do menu kebab (Fase 41) nas colunas `Ações` de **Cadastro de Clientes** (`PeoplePage.jsx`) e **Cadastro de Produtos** (`ProductsPage.jsx`), seguindo o playbook `docs/ACTION_MENU_REFACTORING_GUIDE.md`.

**Escopo**:
- **PeoplePage.jsx**: substituir os botões inline "Editar" / "Excluir" por `<ActionMenu actions={[Editar (Pencil), Excluir (Trash, danger)]} ariaLabel="Ações do cliente" testIdPrefix="client-actions-${id}" />`. Handlers `openEditModal(person)` / `handleDeletePerson(person.id)` preservados.
- **ProductsPage.jsx**: substituir o botão inline "Editar" por `<ActionMenu actions={[Editar (Pencil)]} ariaLabel="Ações do produto" testIdPrefix="product-actions-${id}" />`. O `<select>` de status inline é preservado ao lado do kebab (dentro de um wrapper `flex items-center justify-end gap-2`). Handlers `openEditModal(product)` / `handleStatusChange(product, newStatus)` preservados.
- **ReceivablesPage.jsx**: intencionalmente **não migrado** — sua coluna `Ações` tem apenas o botão "Registrar Pagamento" / "Pago" (sem Editar/Excluir).

**Critérios de Aceite**:
- [x] Trigger kebab (`MoreVertical`) renderizado por linha (sem botões inline "Editar"/"Excluir").
- [x] Menu abre `absolute right-0 mt-2` (bottom-end do trigger) com `z-[80]` (backdrop `z-[70]`).
- [x] Editar com estilo default (`text-gray-700 dark:text-gray-200`); Excluir com estilo danger (`text-red-600 dark:text-red-400 hover:bg-red-50`).
- [x] Acessibilidade: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`, `role="menuitem"`.
- [x] Backdrop click e Escape fecham o menu.
- [x] Clique em item fecha o menu **antes** de invocar o handler.
- [x] `relative` no `<td>` ancora o menu absoluto corretamente.
- [x] Todos os testes anteriores continuam passando + novos testes TDD do kebab.

**Testes**:
- **PeoplePage.test.jsx**: 7 novos testes TDD do kebab (trigger-per-row, menu-hidden-until-click, Editar+Excluir items, danger styling no Excluir, a11y semantics, backdrop-click-to-close, Escape-to-close). 5 testes existentes de Edit/Delete reescritos via `openClientActionsMenu`/`clickClientAction`. **23 → 30 testes**.
- **ProductsPage.test.jsx**: 7 novos testes TDD do kebab (trigger-per-row, menu-hidden-until-click, Editar item, a11y semantics, backdrop-click-to-close, Escape-to-close, opens-edit-modal). 3 testes existentes de Edit reescritos via `openProductActionsMenu`/`clickProductAction`. **29 → 36 testes**.

**Lições**:
- O `ActionMenu` é agnóstico ao número de ações — funciona com 1 ação (Produtos: só Editar) ou 2+ ações (Clientes/Pedidos: Editar + Excluir).
- O `<select>` de status inline do ProductsPage é um controle diferente (dropdown nativo, não botão de texto) — não faz sentido movê-lo para dentro do ActionMenu; mantê-lo ao lado do kebab preserva a UX de troca rápida de status sem abrir modal.
- `relative` no `<td>` é obrigatório — sem ele, o menu absoluto ancora no `<table>` e quebra o alinhamento.

Deliverable: ✅ Colunas `Ações` de Clientes e Produtos com menu kebab (`MoreVertical`) + dropdown `bottom-end`. Clientes: Editar (Pencil) + Excluir (Trash, danger). Produtos: Editar (Pencil) — o `<select>` de status inline é preservado ao lado do kebab. Handlers `openEditModal`/`handleDeletePerson`/`handleStatusChange` preservados. 14 novos testes TDD verdes (7 por tela). **168 backend tests, 303 frontend tests, 471 total tests (zero regressões)**

### 🎯 PHASE 43: Ações condicionais + menu kebab no Controle de Recebíveis

**Objetivo**: refatorar a coluna `Ações` do **Controle de Recebíveis** (`ReceivablesPage.jsx`) com comportamento condicional baseado no **Valor Pendente** (centavos), seguindo o playbook `docs/ACTION_MENU_REFACTORING_GUIDE.md`. Sem novas dependências (reusa `ActionMenu` + `lucide-react`).

**Escopo**:
- **Pendente (Valor Pendente > 0)**: a coluna exibe apenas o kebab; o dropdown contém o item primário destacado **"Registrar Pagamento"** (azul sólido `bg-primary-600`, texto branco) e **"Detalhar"**.
- **Quitado (Valor Pendente == 0)**: remove o texto "Pago" desabilitado; exibe apenas o kebab. O menu contém apenas **"Detalhar"**.
- **Dar baixa preservado**: pedidos de valor zero ainda pendentes de baixa (`pendingCents === 0 && totalCents === 0 && status !== 'QUITADO'`) exibem no menu o item primário **"Dar baixa"**, junto de **"Detalhar"**.
- **Menu dropdown (`bottom-end`)**: `ActionMenu` agora suporta `variant: 'primary'` além de `default`/`danger`, com ícones em coluna de largura fixa e labels alinhados à esquerda. O item **"Detalhar"** usa o ícone `Eye` e `handleViewDetails(order)` executa `console.log('Detalhar — pedido', order.id)` — **stub intencional**: a modal/tela de detalhamento fica para uma fase futura.
- **Estilo do Valor Pendente**: quando `pendingCents === 0`, a célula usa `text-gray-400 dark:text-gray-500` (tom discreto) em vez de `text-gray-900 dark:text-gray-100`.
- **Regra de exibição**: `showPaymentAction = pendingCents > 0 || (totalCents === 0 && order.status !== 'QUITADO')`; o rótulo é `Dar baixa` quando `totalCents === 0`, caso contrário `Registrar Pagamento`. Labels longos do menu usam alinhamento à esquerda e coluna de ícone fixa.
- `testIdPrefix` = `receivable-actions-${order.id}`; `ariaLabel` = "Ações do pedido"; `relative` adicionado ao `<td>`.

**Testes (TDD)**:
- **ReceivablesPage.test.jsx**: 51 → **62 testes**.
  - Novo describe "Action Menu (kebab)" com 12 testes: trigger por linha, ações primárias dentro do menu, kebab-only para QUITADO (sem "Pago"), Dar baixa preservado (pedido zero-item), PARCIAL totalmente pago tratado como quitado, menu oculto até abrir, "Detalhar" visível no menu, callback `console.log` chamado + menu fecha após clique, semântica ARIA (`aria-haspopup`/`aria-expanded`/`role="menu"`/`role="menuitem"`), fechamento por backdrop, por `Escape`, e estilos de Valor Pendente (muted quando 0 / default quando > 0).
  - Teste "Pago" reescrito → kebab-only para QUITADO.
  - Testes do modal de resumo adaptados: como pedidos totalmente pagos/sobrepagos não abrem mais o modal (kebab-only), "clamp pending to R$ 0,00" agora usa o pedido zero-item (ORD-004); o teste de sobrepagamento no modal foi removido (caminho de UI inacessível).

**Decisões**:
- Critério de "quitado" = `pendingCents === 0` (não `order.status`), pois cobre sobrepagamento (PARCIAL com pagamento > total).
- `overpaidOrder` fixture removido do teste (ficou sem uso após a remoção do teste de sobrepagamento no modal).

Deliverable: ✅ Coluna `Ações` do Recebíveis com kebab único; o dropdown reúne "Registrar Pagamento" ou "Dar baixa" conforme o pedido e "Detalhar" para todos os pedidos, com labels alinhados mesmo quando quebram linha. Valor Pendente com tom discreto quando zerado. **168 backend tests, 314 frontend tests, 482 total tests (zero regressões)**

## 🏆 Project Highlights

- **Zero Floating-Point Errors**: All financial calculations use integer cents arithmetic
- **100% Test Coverage**: 482 tests covering all critical paths, edge cases, and regressions
- **Financial Precision**: Decimal(10,2) database fields, accurate status transitions, zero-value "Dar baixa" (only for gift items), zero-against-positive rejection, and confirmed overpayments
- **User Experience**: PT-BR localization, responsive Tailwind design, toast feedback, loading states
- **Code Quality**: TDD methodology, clear error messages, proper auth guards, documented pitfalls
- **Production Ready**: Docker orchestration, persistent storage, adminer for DB inspection

The system is now ready to grow with new features while maintaining code quality, test coverage, and financial integrity.
