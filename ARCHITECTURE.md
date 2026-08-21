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
    │   ├── components/ (layout, auth, dialogs, menus, toast, onboarding; shared widgets such as `ActionMenu`, `ConfirmDialog`, `ProductCombobox`)
    │   ├── context/ (auth and theme)
    │   ├── pages/
    │   │   ├── LoginPage.jsx, RegisterPage.jsx                # Small pages kept as single files
    │   │   ├── DashboardPage.jsx, PeoplePage.jsx, OrdersPage.jsx, ProductsPage.jsx, StockPage.jsx   # One-line shims re-exporting each page folder
    │   │   ├── Dashboard/   (index.jsx, useDashboard.js, components/, utils/dashboardHelpers.js)
    │   │   ├── People/      (index.jsx, usePeople.js, components/, utils/peopleHelpers.js)
    │   │   ├── Orders/      (index.jsx, useOrders.js, useOrderPayments.js, components/, utils/orderHelpers.js, utils/receivablesHelpers.js)
    │   │   ├── Products/    (index.jsx, useProducts.js, components/, utils/productHelpers.js)
    │   │   ├── Stock/       (index.jsx, useStock.js, components/, utils/stockHelpers.js)
    │   ├── services/api.js
    │   └── utils/ (money, dates, WhatsApp, Excel export)
    ├── docs/frontend-architecture-guide.md   # Progressive complexity policy, conventions, page-refactoring playbook
    └── tests/
```

## Domain Model

- `User` owns `Person` and `Order` records; ownership is enforced in every controller.
- `Person` stores client data, including WhatsApp, Instagram, address, VIP, and dōTERRA membership flags. The `isSelf` flag (at most one per user) marks the logged-in user's own record; `POST /api/people/self` gets or creates it (named after the user's `username`).
- `Order` contains order metadata, status, payment type, notes, and nested `Item`/`Payment` records. `orderNumber` is unique per user.
- `Item` stores a negotiated `chargedValue` plus optional product, member-price, PV, and details snapshots.
- `Payment` belongs to an order and optionally a person. Payment creation runs in a Prisma transaction and recalculates order status.
- `Product` is a global catalog record with `ProductStatus`: `ATIVO`, `INDISPONIVEL`, or `INATIVO`.
- `ProductPrice` stores historical regular price, member price, PV, and validity intervals.
- `Inventory` stores the current stock balance per user+product (`@@unique([userId, productId])`).
- `StockMovement` records the signed-quantity history (`ENTRADA`/`SAIDA`/`AJUSTE`) for each user+product, used both to compute and to audit the inventory balance.

## API Areas

- `/api/auth`: login and self-registration.
- `/api/people`: authenticated client CRUD.
- `/api/orders`: authenticated order/item CRUD, payments, and per-person balances.
- `/api/dashboard`: authenticated KPIs, person balances, and yearly breakdown.
- `/api/products`: catalog CRUD, status/search/sort/pagination, current prices, and price history.
- `/api/stock`: authenticated inventory listing, per-product movement history, movement registration (transactional, signed balance), and `POST /movements/:id/undo` to undo the last movement.

## Important Design Decisions

- Financial calculations use integer cents in application code; database monetary fields remain `Decimal(10,2)`.
- The frontend loads the product catalog once with `pageSize=all`; search, status filtering, sorting, and infinite-scroll slicing are client-side.
- Products with `ATIVO` or `INDISPONIVEL` status can be selected for orders; `INATIVO` products cannot be newly selected.
- The catalog loader is an idempotent diff and preserves manual `INDISPONIVEL` status.
- Responsive tables keep semantic table markup and use Flowbite's Tailwind-only `data-label` card pattern below `md`.
- `ActionMenu` is the shared kebab menu for row actions. Menu panels use `z-[80]`.
- The frontend uses a Vite `/api` proxy, avoiding browser-side localhost/CORS issues on local networks.
- Complex pages follow a "page-as-orchestrator" architecture: each page lives in `pages/{Nome}/` with `index.jsx` (≈60–150 lines), a `use{Nome}.js` custom hook owning state, API calls, and mutation handlers, local `components/` for subcomponents, and `utils/` for pure helpers. The original `*Page.jsx` file is a one-line shim (`export { default } from './{Nome}/index.jsx';`) so existing imports keep working. See `frontend/docs/frontend-architecture-guide.md` for the progressive complexity policy and the page-refactoring playbook.
- Stock movements are signed (`ENTRADA` `+q`, `SAIDA` `-q` forbidding negative stock, `AJUSTE` absolute target with signed delta); `registerMovement` and `undoLastMovement` each run in a single Prisma transaction.
- Only the **last** movement of a product can be undone (enforced by counting movements with a greater `createdAt`); undoing the only movement deletes the `Inventory` row so the product leaves the stock list and becomes available for a fresh initialization.
- Items assigned to a self person (`Person.isSelf`) are treated as **already received**: their value never contributes to pending balances (per-person, order-level, dashboard, and yearly breakdown), and they never block an order from reaching `QUITADO`. No `Payment` record is created for them, so they do not affect `currentMonthReceipts`. The shared helper `backend/src/utils/receivables.js` (`computeOrderStatus`, `personPendingCents`, `syncOrderStatusesForPersons`) centralizes this rule; order status is now recomputed on order/item create/update/delete and when a person's `isSelf` flag toggles. The order form's person select always offers the user as an "Eu (você)" option (auto-creating the self person via `POST /api/people/self` on first selection), and the "Esta pessoa sou eu" checkbox in the People form consolidates/transfers the flag.
- The "Adicionar Estoque" product selector is filtered client-side (`availableProducts`) from the catalog loaded lazily on dialog open (`GET /products?pageSize=all`) minus the products already in the user's inventory, regardless of product status.
