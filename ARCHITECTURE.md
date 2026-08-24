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
│   │   ├── services/stockService.js         # Canonical applyMovement primitive shared by StockController and ordersController
│   │   ├── middlewares/auth.js
│   │   ├── routes/
│   │   └── utils/ (money, CSV parsing, catalog loading, receivables, stockDiff)
│   └── tests/
└── frontend/
    ├── src/
    │   ├── App.jsx, main.jsx, index.css
    │   ├── components/ (layout, auth, dialogs, menus, toast, onboarding; shared widgets such as `ActionMenu`, `ConfirmDialog`, `ProductCombobox`, `SearchInput`, `SortableHeader`)
    │   ├── context/ (auth and theme)
    │   ├── pages/
    │   │   ├── LoginPage.jsx, RegisterPage.jsx                # Small pages kept as single files
    │   │   ├── DashboardPage.jsx, PeoplePage.jsx, OrdersPage.jsx, ProductsPage.jsx, StockPage.jsx   # One-line shims re-exporting each page folder
    │   │   ├── Dashboard/   (index.jsx, useDashboard.js, components/, utils/dashboardHelpers.js)
    │   │   ├── People/      (index.jsx, usePeople.js, components/, utils/peopleHelpers.js)
    │   │   ├── Orders/      (index.jsx, useOrders.js, useOrderFilters.js, useOrderPayments.js, components/, utils/orderHelpers.js, utils/receivablesHelpers.js)
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
- `Order` contains order metadata, status, payment type, notes, an order-level `shippingValue` (frete, `Decimal(10,2)`, default `0`, included in `totalValue`), and nested `Item`/`Payment` records. `orderNumber` is unique per user.
- `Item` stores a negotiated `chargedValue` plus optional product, member-price, PV, and details snapshots. It also carries a `quantity` (integer ≥ 1, default 1), a `forStock` boolean (the "para meu estoque" toggle, only meaningful for self-person items and required to reference a catalog product), and a `chargedValueMode` enum (`UNIT` — chargedValue is the per-unit price, line total = chargedValue × quantity; `TOTAL` — chargedValue is the full line value). For stock-bound kit items it also carries `kitStockMode` (`KIT` | `COMPONENTS`, the user's choice of what goes to stock) and `kitSnapshot` (a JSON frozen copy of the kit's composition at item creation/registration time).
- `Payment` belongs to an order and optionally a person. Payment creation runs in a Prisma transaction and recalculates order status.
- `Product` is a global catalog record with `ProductStatus` (`ATIVO`, `INDISPONIVEL`, or `INATIVO`) and a `ProductType` (`SIMPLES`, default, or `KIT`).
- `KitComposition` holds the live composition of a `KIT` product: one row per component (`componentProductId`, `quantity` inside the kit), `@@unique([kitProductId, componentProductId])`. Kits contain only `SIMPLES` products (no nested kits), each with a positive quantity, and must have at least one component to be saved. Order items snapshot this composition into `Item.kitSnapshot` at creation time so later kit edits never affect stock control of already-registered orders.
- `ProductPrice` stores historical regular price, member price, PV, and validity intervals.
- `Inventory` stores the current stock balance per user+product (`@@unique([userId, productId])`).
- `StockMovement` records the signed-quantity history (`ENTRADA`/`SAIDA`/`AJUSTE`) for each user+product. It optionally links to the originating `Order` and `Item` via nullable `orderId` / `itemId` (`ON DELETE SET NULL`) so that order-generated movements can be distinguished from manual ones and survive order/item deletion while preserving audit history. Each movement carries an `effectiveDate` (defaults to `now()`) representing the date the entry/exit actually happened, distinct from `createdAt` (insertion time); the history screen shows both columns. Manual movements default to today and are user-editable; movements generated from an order always use the order's `orderDate` (the controller rejects with `400` if that date is missing).

## API Areas

- `/api/auth`: login and self-registration.
- `/api/people`: authenticated client CRUD. `GET /api/people` supports `q` (name/WhatsApp, accent- and case-insensitive via PostgreSQL `unaccent`/`lower`), `classification` (`vip` | `member` | `vip_member` | `none`, mapped to `isVip`/`isDoterraMember`), `sortBy`, and `sortDir`.
- `/api/orders`: authenticated order/item CRUD, payments, and per-person balances. `GET /api/orders` supports `q` + `searchField` (`all` | `orderNumber` | `accountOwner` | `orderNotes`, all accent- and case-insensitive via `unaccent`/`lower`), `status` (single or comma-separated), `paymentType`, `sortBy` (including computed `pendingValue`/`totalPv`), and `sortDir`. The search term is committed on submit; filter/sort changes refetch server-side.
- `/api/dashboard`: authenticated KPIs, person balances, and yearly breakdown.
- `/api/products`: catalog CRUD, status/search/sort/pagination, current prices, price history, and the derived `pricePerPv` value (member price divided by PV, rounded to two decimal places). Create/update accept `productType` (`SIMPLES`|`KIT`) and `components` (`[{ componentProductId, quantity }]`); the response includes `productType` and the kit `components` (as `[{ componentProductId, quantity }]`). The CSV catalog loader only creates `SIMPLES` products; kits are composed manually via the UI.
- `/api/stock`: authenticated inventory listing, per-product movement history, movement registration (transactional, signed balance), and `POST /movements/:id` to undo the last movement. `POST /movements` accepts an optional `effectiveDate` (`YYYY-MM-DD`, defaults to server `now()`) and `GET /api/stock` supports `q` (product code/name, accent- and case-insensitive), `sortBy`, and `sortDir`.

## Important Design Decisions

- Financial calculations use integer cents in application code; database monetary fields remain `Decimal(10,2)`.
- Product `pricePerPv` is calculated at API projection time using integer/`BigInt` arithmetic and half-up rounding; it is not persisted. Products can be sorted by this derived value.
- The PostgreSQL `unaccent` extension (enabled by migration `20260821180000_enable_unaccent_extension`) is used by the shared `backend/src/utils/search.js` helper for `q` text searches on `/api/people`, `/api/orders` and `/api/stock`, so that accented and unaccented terms match interchangeably (e.g. `"Cássia"` matches `"cassia"`). The helper escapes LIKE wildcards (`%`, `_`, `\`) and combines with the existing userId/filters via a Prisma `id IN (...)` clause.
- The frontend loads the product catalog once with `pageSize=all`; search, status filtering, sorting, and infinite-scroll slicing are client-side.
- Clients (`/people`) and Stock (`/stock`) follow the same client-side pattern: fetch the full list and filter/sort in memory as the user types. Orders (`/orders`) is server-side: the search term is submitted on Enter/button and filters + sort trigger a `GET /api/orders` refetch with all params combined (filters and sorting applied together), with an `AbortController` cancelling in-flight requests on rapid changes.
- Sortable table headers (`SortableHeader`) and the search input (`SearchInput`) are shared `src/components/` widgets; column headers toggle asc/desc with an `aria-sort` indicator.
- Products with `ATIVO` or `INDISPONIVEL` status can be selected for orders; `INATIVO` products cannot be newly selected.
- The catalog loader is an idempotent diff and preserves manual `INDISPONIVEL` status.
- Responsive tables keep semantic table markup and use Flowbite's Tailwind-only `data-label` card pattern below `md`.
- `ActionMenu` is the shared kebab menu for row actions. Menu panels use `z-[80]`.
- The frontend uses a Vite `/api` proxy, avoiding browser-side localhost/CORS issues on local networks.
- Complex pages follow a "page-as-orchestrator" architecture: each page lives in `pages/{Nome}/` with `index.jsx` (≈60–150 lines), a `use{Nome}.js` custom hook owning state, API calls, and mutation handlers, local `components/` for subcomponents, and `utils/` for pure helpers. The original `*Page.jsx` file is a one-line shim (`export { default } from './{Nome}/index.jsx';`) so existing imports keep working. See `frontend/docs/frontend-architecture-guide.md` for the progressive complexity policy and the page-refactoring playbook.
- Stock movements are signed (`ENTRADA` `+q`, `SAIDA` `-q` forbidding negative stock, `AJUSTE` absolute target with signed delta); `registerMovement` and `undoLastMovement` each run in a single Prisma transaction.
- Only the **last** movement of a product can be undone (enforced by counting movements with a greater `createdAt`); undoing the only movement deletes the `Inventory` row so the product leaves the stock list and becomes available for a fresh initialization.
- **Order ↔ Stock integration**: when an order contains a self-person item flagged `forStock` with a catalog product, the `ordersController` automatically creates an `ENTRADA` `StockMovement` (quantity = `item.quantity`, reason `Pedido <orderNumber>`) inside the same Prisma transaction as the order/item mutation. On `updateOrder`, `addItemToOrder`, `updateItem`, `deleteItem`, and `deleteOrder`, the controller computes the net per-product stock delta (via the pure `computeStockDiff` helper in `backend/src/utils/stockDiff.js`) and applies `ENTRADA`/`SAIDA` movements tied to `orderId`. All mutations now run in a Prisma `$transaction`, and stock reversals are blocked with `400 Insufficient stock` (with an orientative message pointing to the Estoque page) when the current inventory cannot cover the deduction, preserving the never-negative rule. The canonical movement logic is extracted into `backend/src/services/stockService.js` (`applyMovement(client, ...)`), which both the manual `StockController.registerMovement` and `ordersController` call. Every order-generated movement records `effectiveDate = order.orderDate` (controllers guard with `400 Data do pedido é obrigatória para movimentações de estoque` if the order date is missing). **Movements generated by an order (`orderId != null`) cannot be undone via the stock endpoint** (`POST /api/stock/movements/:id/undo` rejects with `400` + `orderNumber`/`orderId`); reversal is driven exclusively by editing/removing the item in the order. The frontend hides the undo button in this case and instead shows an info card with the order number and a "Ver pedido" deep-link to `/orders?editOrder=<id>` (auto-opens the edit modal).
- **Kit products and stock**: a `KIT` product is priced manually (own `regularPrice`/`memberPrice`/`pv`); its composition lives in `KitComposition`. When a self-person item referencing a kit is flagged `forStock`, the user must choose a `kitStockMode`: `KIT` stocks the kit product as a single unit, `COMPONENTS` stocks every component scaled by the kit quantity (`componentQty × item.quantity`). The shared helpers in `backend/src/utils/kitStock.js` — `resolveKitSnapshot(client, productId)` and `expandItemToStockProducts(item)` — expand an item into its effective `[{ productId, quantity }]` stock effect; `computeStockDiff` uses this expansion so quantity changes and mode switches (`KIT` ↔ `COMPONENTS`) produce the correct minimal `ENTRADA`/`SAIDA` movements automatically. The kit composition is **frozen** into `Item.kitSnapshot` when the item is created (or when its product changes); later edits to a kit never affect stock control of already-registered orders, even when their items are edited (requirement 5). `updateOrder` was refactored from a destructive `deleteMany`+`create` to a **sync-by-id** flow: the frontend sends the existing item `id` (UUID) for kept items, the controller updates them (preserving `kitSnapshot`), creates new ones, and deletes removed ones — this is what keeps frozen snapshots and stock history links intact across order edits.
- **Per-item quantity and price mode**: every `Item` carries `quantity` and `chargedValueMode` (`UNIT`|`TOTAL`). Financial math uses the `lineValueCents(item)` helper (in `backend/src/utils/money.js` and mirrored on the frontend) which returns `toCents(chargedValue) * quantity` in `UNIT` mode or just `toCents(chargedValue)` in `TOTAL` mode. This is used in `computeOrderStatus`, order `totalValue` computation, payment balance/item totals, and frontend `getOrderSelfCents` / `getOrderTotalPV` / order-form `calculateTotal`. Existing items (qty=1, UNIT) are fully backward-compatible.
- **Order shipping (frete)**: `Order.shippingValue` (migration `20260823100000_add_order_shipping_value`) is an order-level cost, default `0`, included in `totalValue` and therefore in pending balances and the payment flow. `computeOrderStatus` takes an optional `shippingCents`: once every per-person balance is settled, an order with chargeable non-self items only reaches `QUITADO` when the sum of payments also covers `non-self items + shipping`; self-only and gift-only orders are not blocked by shipping. The order form shows an editable **Frete (R$)** input in a bottom summary block (testid `order-freight`) placed after the items list and before the submit buttons, alongside read-only `Soma dos Produtos` / `Soma dos PV` (testids `order-totals-charged-footer` / `order-totals-pv-footer`); the top summary block is kept for live feedback. The payment and details modals display a **Frete** row (`order-summary-shipping` / `details-summary-shipping`).
- **Effective PV rule**: the `effectivePvCents(item)` helper (backend `utils/money.js`, frontend `orderHelpers.js`) returns `0` when `lineValueCents(item) === 0`, so free/zero-charged items accumulate no PV. It drives the frontend per-item PV field, both order-form summary blocks, the table's `PV Total` column, and the backend `totalPv` in-memory sort.
- Items assigned to a self person (`Person.isSelf`) are treated as **already received**: their value never contributes to pending balances (per-person, order-level, dashboard, and yearly breakdown), and they never block an order from reaching `QUITADO`. No `Payment` record is created for them, so they do not affect `currentMonthReceipts`. The shared helper `backend/src/utils/receivables.js` (`computeOrderStatus`, `personPendingCents`, `syncOrderStatusesForPersons`) centralizes this rule; order status is now recomputed on order/item create/update/delete and when a person's `isSelf` flag toggles. The order form's person select always offers the user as an "Eu (você)" option (auto-creating the self person via `POST /api/people/self` on first selection), and the "Esta pessoa sou eu" checkbox in the People form consolidates/transfers the flag.
- **Team orders**: an `Order` flagged `isTeamOrder` (migration `20260824164617_add_team_order`) records an order that another team member placed **and paid for** themselves. It carries the usual order metadata and items (for reference) but is excluded from the user's financial tracking: it is never `PENDENTE`/`PARCIAL`/`QUITADO` — `computeOrderStatus` returns the dedicated `EQUIPE` status whenever `isTeamOrder` is true — and it never generates stock movements, never accepts payments (the API rejects `POST /api/orders/:id/payments` on team orders), and the dashboard filters it out (`where isTeamOrder: false`), so it contributes to none of `totalPending`, `totalPaid`, `currentMonthReceipts`, `personBalances`, or `yearlyBreakdown`. In the UI the toggle "Pedido da equipe" shows a notice and hides the per-item "para meu estoque" option, the row shows an `Equipe` badge with `—` pending, and the payment action is hidden; a team order can be toggled back to a normal order, which recomputes to the appropriate standard status.
- The "Adicionar Estoque" product selector is filtered client-side (`availableProducts`) from the catalog loaded lazily on dialog open (`GET /products?pageSize=all`) minus the products already in the user's inventory, regardless of product status.
