# Receivables Control System - Architecture Documentation

## Overview
This document describes the current state of the project architecture, file organization, and how to run the system. The project is currently in **Phase 9: Backend Payments & Status Engine** completed.

## Technology Stack
- **Backend**: Node.js (Express) with Prisma ORM
- **Frontend**: React with Vite and Tailwind CSS
- **Database**: PostgreSQL 15
- **Infrastructure**: Docker and Docker Compose

## Ports Configuration
- **Backend API**: http://localhost:4000
- **Frontend Application**: http://localhost:3000
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
│   ├── .env                    # Environment variables (DB, JWT, etc.)
│   ├── prisma/
│   │   └── schema.prisma       # Prisma database schema
│   └── src/
│       ├── server.js           # Entry point (starts Express server)
│       ├── app.js              # Express app setup (CORS, middleware, routes)
│       ├── config.js           # Environment configuration loader
│       │   └── database.js     # Prisma client singleton
│       ├── middlewares/
│       │   └── auth.js         # JWT authentication middleware
│ ├── controllers/
│ │ ├── authController.js # Auth login controller
│ │ ├── peopleController.js # People CRUD with Zod validation
│ │ ├── ordersController.js # Orders + Items CRUD with Zod validation
│ │ └── paymentsController.js # Payments + balance with transactional status engine
│ └── routes/
│ ├── authRoutes.js # Auth route definitions (/api/auth/login)
│ ├── peopleRoutes.js # People CRUD routes (/api/people)
│ └── ordersRoutes.js # Orders + Items + Payments routes (/api/orders, /api/orders/items/:id, /api/orders/:orderId/payments, /api/orders/:orderId/balance)
├── frontend/
│   ├── Dockerfile              # Frontend container definition
│   ├── package.json            # Frontend dependencies & scripts
│   ├── vitest.config.js        # Vitest config for frontend (jsdom)
│   ├── index.html              # HTML template
│   ├── main.jsx                # React entry point
│   ├── index.css               # Tailwind CSS directives
│   ├── App.jsx                 # Root React component with AppLayout + Outlet
│   ├── services/
│   │   └── api.js              # Axios client with auth interceptor
│   ├── context/
│   │   └── AuthContext.jsx     # Auth state (login/logout/token)
│   ├── components/
│   │   └── ProtectedRoute.jsx  # Route guard for auth
│   ├── pages/
│   │   ├── LoginPage.jsx       # Login form (PT-BR)
│   │   ├── PeoplePage.jsx      # People CRUD with modals (PT-BR)
│   │   └── OrdersPage.jsx      # Orders CRUD with dynamic item rows (PT-BR)
│   └── tests/
│       ├── setup.js            # @testing-library/jest-dom import
│       ├── PeoplePage.test.jsx # 14 PeoplePage tests
│       └── OrdersPage.test.jsx # 18 OrdersPage tests
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
  - Volumes: ./frontend:/app (live code reload), /app/node_modules
- **adminer**: Database administration UI
  - Image: adminer
  - Ports: 8080:8080
  - Depends on: db

## Backend Configuration (.env)
```dotenv
# Database Configuration
DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"

# JWT Configuration
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="24h"

# Server Configuration
PORT=4000
NODE_ENV=development
```

## Available npm Scripts
### Backend (`backend/package.json`)
- `npm run dev` - Start backend with nodemon (development)
- `npm start` - Start backend with node (production)

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

## Current Implementation Status (Phase 9 Complete)
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
✅ AppLayout with header, navigation links (Pessoas/Pedidos), and logout button
✅ Protected route component blocking unauthenticated access (`src/components/ProtectedRoute.jsx`)
✅ PeoplePage component with table listing, create/edit modals, delete confirmation (PT-BR)
✅ OrdersPage component with table listing, status badges, dynamic multi-row item sub-form (PT-BR)
✅ Environment configuration files
✅ Dockerfiles for both backend and frontend
✅ Volume mounting for live development
✅ Prisma schema with User, Person, Order, Item, Payment entities
✅ Database migration completed and tables created
✅ Proper relationships and cascade rules established
✅ Working JWT authentication system with bcrypt password hashing
✅ Admin user seeded in database
✅ Axios client with automatic Bearer token injection from localStorage (`src/services/api.js`)
✅ Auth context provider managing login, logout, and token validation (`src/context/AuthContext.jsx`)
✅ Tailwind CSS setup with PostCSS and Vite integration
✅ Login page with PT-BR labels and error messages (`src/pages/LoginPage.jsx`)
✅ React Router routing with login and protected routes
✅ Backend tests: 34 tests passing (Vitest + supertest)
- `backend/tests/people.test.js`: 14 tests for People CRUD
- `backend/tests/orders.test.js`: 20 tests for Orders + Items CRUD
✅ Frontend tests: 32 tests passing (Vitest + React Testing Library)
- `frontend/tests/PeoplePage.test.jsx`: 14 tests
- `frontend/tests/OrdersPage.test.jsx`: 18 tests
✅ Payment creation endpoint with transactional consistency (`POST /api/orders/:orderId/payments`)
✅ Balance validation: rejects overpayment (amount > pending) and zero/negative amounts
✅ Automatic order status transitions: PENDENTE → PARCIAL → QUITADO
✅ Per-person balance calculation within Prisma transaction
✅ Balance breakdown endpoint (`GET /api/orders/:orderId/balance`) returning per-person pending amounts
✅ Payment and balance routes protected with JWT authentication middleware

## Next Steps (Phase 10)
When ready to proceed, Phase 10 will involve:
- Backend tests for payment processing and status transitions
- Unit tests for: partial payment, full payment, overpayment rejection, zero/negative amount rejection
- Integration tests for: valid payment returns 201, overpayment returns 400, unauthenticated returns 401, non-existent order returns 404
- Balance endpoint tests: correct per-person balance, returns 0 for fully paid, 404 for non-existent order
- Transactional consistency and rollback tests

## Notes for Developers/Agents
- Backend source is mounted at `/app` inside container for live editing
- Frontend source similarly mounted for hot module replacement
- Node modules are installed within containers (separate from host)
- Environment variables are loaded via `.env` file for backend
- Frontend assumes backend API at `http://localhost:4000` (adjust in future API service)
- All financial calculations should use Decimal(10,2) as per financial rules in AGENTS.md