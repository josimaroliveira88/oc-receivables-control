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

🔐 PHASE 3: Express Core Server & Auth Layer

Context: The Database migration was completed. We need an application endpoint entrypoint with security context[cite: 41, 107].
Stack: Express, JWT, Bcrypt, Zod[cite: 28, 40].

Task:
Implement the core API backend architecture. Generate the following application assets:
1. `src/server.js` & `src/app.js`: Express application instantiation including CORS policies for port 3000 and centralized error validation middleware[cite: 44, 45, 114, 115].
2. `src/middlewares/auth.js`: Token lookup processing incoming `Authorization: Bearer <token>` HTTP headers[cite: 44, 46, 113, 114].
3. `src/controllers/authController.js` & `src/routes/authRoutes.js`: Expose a `POST /api/auth/login` endpoint[cite: 44, 45, 111, 113]. Validate arguments with Zod[cite: 110]. Match against a standard system profile hashed using bcrypt[cite: 42, 111]. Return `{ token, expiresIn: "24h" }`[cite: 43, 112].

Deliverable: A working Express server that can start successfully and respond to `POST /api/auth/login` with a valid JWT payload and expiration field.

💻 PHASE 4: Frontend Authentication Flow

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

📋 PHASE 5: Frontend Component CRUD (People & Orders)

Context: Auth framework is operational. Need UI panels to input data resources[cite: 53, 124].
Stack: React, Tailwind CSS, Axios[cite: 28, 53].

Task:
Build management pages targeting data generation. Create:
1. `src/pages/PeoplePage.jsx`: Renders people listing inside a grid layout table and handles creation/modification modals[cite: 53, 55, 125, 129].
2. `src/pages/OrdersPage.jsx`: Order setup module featuring a dynamic, multi-row sub-form array allowing real-time insertion/removal of multiple line items[cite: 55, 126, 129]. Each line item must capture a text description, cost value, and link to a specific Person from a dropdown menu[cite: 55, 126].
- Interface details must be implemented in Portuguese (Brazil): "Cadastro de Pessoas", "Gestão de Pedidos", "Nome", "Valor (R$)", "Adicionar Item"[cite: 55, 129].

Deliverable: Functional people and orders CRUD pages where users can create and edit records through the interface, and the pages render correctly inside the authenticated app shell.

💰 PHASE 6: Financial Balances Processing Engine (Backend)

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

Deliverable: A backend payment endpoint that persists valid payments, enforces balance validation, and updates order status to `PARCIAL` or `QUITADO` as appropriate.

📊 PHASE 7: Payment Tracking UI & Badges

Context: Calculations backend is ready. Need tracking layout screens[cite: 65, 138, 144].
Stack: React, Tailwind CSS, Axios[cite: 28, 70].

Task:
Implement the tracking panel `src/pages/ReceivablesPage.jsx`[cite: 68, 145].
Provide a UI layout showing financial statuses using visual badge elements[cite: 66, 142, 145]:
- Green Badge: "✅ Quitado" [cite: 66, 145]
- Yellow Badge: "⚠️ Parcial" [cite: 66, 145]
- Red Badge: "🔴 Pendente" [cite: 66, 145]
Create a processing payment modal containing validation guards: prevent submit actions if input value fields bypass the user's outstanding balance ceiling[cite: 68, 141, 145]. Render a standard toast prompt message in Brazilian Portuguese ("Pagamento registrado com sucesso!" / "Valor excede o saldo pendente")[cite: 145].

Deliverable: A payment tracking UI that displays status badges, validates overpayment at the form layer, and confirms success with toast feedback.

📈 PHASE 8: Executive Summary Dashboard & XLSX Generation

Context: All ledger transactional pipelines operate normally. Need high-level analytics layout[cite: 71, 146, 152].
Stack: React, Recharts, SheetJS (xlsx library)[cite: 28, 72].

Task:
Develop `src/pages/DashboardPage.jsx`[cite: 74, 148, 153]. Design an analytic interface incorporating:
1. KPI Status Widgets: Displays metrics for "Total Pendente", "Total Quitado", and "Recebimentos (Mês Atual)"[cite: 72, 74, 149, 153].
2. Performance Bar Graphs: Using Recharts, plot balances due indexed by Person[cite: 74, 149].
3. Client-Side Excel exporter button: Add an action element labeled "📥 Exportar para Excel" compiling active application context into a `.xlsx` data workbook split by descriptive sheets: "Pedidos", "Pessoas", "Histórico de Pagamentos", "Saldo Pendente"[cite: 72, 150, 153]. Force cells formatting to follow BRL monetary mask[cite: 75, 76, 150].

Deliverable: A dashboard where KPIs and charts render correctly and the Excel exporter button generates a downloadable `.xlsx` workbook with properly formatted Brazilian currency data.