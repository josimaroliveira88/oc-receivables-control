# Receivables Control System: Architecture

## Overview

Full-stack financial tracking application for clients, dōTERRA orders, receivables, payments, reporting, and product catalog management. The backend is a stateless JWT-protected REST API; the frontend is a React SPA served by Vite.

## Technology

- Backend: Node.js, Express, Prisma ORM, Zod, JWT, bcryptjs, morgan.
- Frontend: React 18, React Router 6, Vite, Tailwind CSS 3, Flowbite plugin, Recharts, SheetJS, lucide-react.
- Database: PostgreSQL 15.
- Tests: Vitest, Supertest, React Testing Library, jsdom.
- Local infrastructure: Docker Compose with PostgreSQL and Adminer.

## Runtime and Configuration

| Service | Local address | Notes |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Vite dev server; `/api` is proxied to the backend. |
| Backend | `http://localhost:4000` | Express API; health endpoint is `/health`. |
| PostgreSQL | `localhost:5432` | Docker volume `postgres_data`. |
| Adminer | `http://localhost:8080` | Database UI. |

Backend configuration is in the gitignored `backend/.env`, based on `backend/.env.default`:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `NODE_ENV`
- Optional `CORS_ORIGIN`

Frontend uses `API_URL` for the Vite proxy target. Docker sets it to `http://backend:4000`; the local default is `http://localhost:4000`.

Start the complete environment with:

```text
docker compose up --build
```

For a database with existing data, apply migrations with `npx prisma migrate deploy`, never `prisma migrate dev`.

## Repository Structure

```text
.
├── AGENTS.md
├── ARCHITECTURE.md
├── docker-compose.yml
├── docs/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── scripts/loadProducts.js
│   ├── src/
│   │   ├── app.js, server.js, config.js
│   │   ├── config/database.js
│   │   ├── controllers/
│   │   ├── middlewares/auth.js
│   │   ├── routes/
│   │   └── utils/ (money, CSV parsing, catalog loading)
│   └── tests/
└── frontend/
    ├── src/
    │   ├── App.jsx, main.jsx, index.css
    │   ├── components/ (layout, auth, dialogs, menus, toast, onboarding)
    │   ├── context/ (auth and theme)
    │   ├── pages/ (login, registration, dashboard, clients, orders, receivables, products)
    │   ├── services/api.js
    │   └── utils/ (money, dates, WhatsApp, Excel export)
    └── tests/
```

## Domain Model

- `User` owns `Person` and `Order` records; ownership is enforced in every controller.
- `Person` stores client data, including WhatsApp, Instagram, address, VIP, and dōTERRA membership flags.
- `Order` contains order metadata, status, payment type, notes, and nested `Item`/`Payment` records. `orderNumber` is unique per user.
- `Item` stores a negotiated `chargedValue` plus optional product, member-price, PV, and details snapshots.
- `Payment` belongs to an order and optionally a person. Payment creation runs in a Prisma transaction and recalculates order status.
- `Product` is a global catalog record with `ProductStatus`: `ATIVO`, `INDISPONIVEL`, or `INATIVO`.
- `ProductPrice` stores historical regular price, member price, PV, and validity intervals.

## API Areas

- `/api/auth`: login and self-registration.
- `/api/people`: authenticated client CRUD.
- `/api/orders`: authenticated order/item CRUD, payments, and per-person balances.
- `/api/dashboard`: authenticated KPIs, person balances, and yearly breakdown.
- `/api/products`: catalog CRUD, status/search/sort/pagination, current prices, and price history.

## Important Design Decisions

- Financial calculations use integer cents in application code; database monetary fields remain `Decimal(10,2)`.
- The frontend loads the product catalog once with `pageSize=all`; search, status filtering, sorting, and infinite-scroll slicing are client-side.
- Products with `ATIVO` or `INDISPONIVEL` status can be selected for orders; `INATIVO` products cannot be newly selected.
- The catalog loader is an idempotent diff and preserves manual `INDISPONIVEL` status.
- Responsive tables keep semantic table markup and use Flowbite's Tailwind-only `data-label` card pattern below `md`.
- `ActionMenu` is the shared kebab menu for row actions. Menu panels use `z-[80]`.
- The frontend uses a Vite `/api` proxy, avoiding browser-side localhost/CORS issues on local networks.
