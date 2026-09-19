# Finances Module — Implementation Plan

Status: **planning only — no code written yet.**
This document is the single source of truth for the finances module. It is split into
independent phases so each one can be implemented in a separate agent session.

---

## 1. Context and goal

The system already tracks dōTERRA purchase orders (`Order.orderType = COMPRA`), stock
sales (`Order.orderType = VENDA`), receivables, and payments. It does **not** have an
independent financial ledger, so the user cannot see the real cash flow of the account
(what actually entered and left, when, and why).

Goal: add a **unified financial ledger** (`FinancialTransaction`) that is fed
**automatically** from sales and dōTERRA orders, plus **manual** entries for everything
that happens outside those flows (e.g. dōTERRA bonuses credited directly to the account).

Scope for this first delivery (agreed with the user):

- Objectives: **cash flow** (money in / money out / balance) and **real profitability**
  (income − expenses, including categorised operational expenses).
- Automatic entries: sales payments and dōTERRA orders.
- Manual entries with **default categories + custom categories**.
- InfinitePay: **no automatic entry on payment**; the user registers a redemption
  (`resgate`) informing the amount and date, and that creates the entry linked to the sale.
- Gateway fees: **informative only — never an automatic expense entry**.
- No reports/charts yet (future phases). The current dashboard is **removed now** and
  replaced later by new reports.

Non-goals (this delivery): bank/gateway statement import, reconciliation, DRE, forecasts,
per-installment schedules.

---

## 2. Confirmed decisions (from the discovery Q&A)

| # | Decision |
| --- | --- |
| 1 | Objectives are cash flow **and** profitability. |
| 2 | Exits = dōTERRA orders + user-categorised operational expenses. |
| 3 | Card sales go through InfinitePay; money only enters when the user requests the redemption in the InfinitePay portal (same day or a future date). |
| 4 | Statement import is desirable but **not a priority now** (design the model so it can be added later). |
| 5 | Start with a default set of categories, but allow custom categories. |
| 6 | Keep charged value, gateway fee, net received, and fee-passthrough separated. |
| 7 | Start simple: automatic ledger + manual entries + categories. **No reports yet.** |
| 8 | Remove the dashboard now; replace it with new reports in the future. |
| 9 | Entries/exits originating from a sale or order must **link back to that record**. |
| 10 | Gateway fees must **not** generate an automatic exit; they may appear as informative data. |
| 11 | Transactions are born **already settled** (`COMPENSADO`) — the transaction date is the settlement date. No pending state in the MVP. |
| 12 | dōTERRA bonus is a **manual income** category, with no link to order/sale. |

---

## 3. Value mapping — what is an entry and what is an exit

### 3.1 dōTERRA order (`Order.orderType = COMPRA`) → **exit**

- **One transaction per order** (per the user's request).
- `amount` = `Order.doterraValue` when present, otherwise `Order.totalValue`.
  - Note: `doterraValue` is set by `ordersService` to the same computed total as
    `totalValue` (`fromCents(totalCents)`), so both are equal today. The orders list's
    **"Valor"** column renders `totalValue` (`frontend/src/pages/Orders/components/OrdersTable.jsx:117,211`).
    Using `doterraValue ?? totalValue` matches the visible column and the user's intent.
  - Freight (`shippingValue`) is already included in `totalValue`; it is **not** split into
    a second transaction in this delivery.
- `transactionDate` = `Order.orderDate`.
- `type = DESPESA`, `origin = PEDIDO_DOTERRA`, default category **"Compra de produtos dōTERRA"**.
- Team orders (`isTeamOrder = true`) generate **no** transaction.
- Deleting the order deletes the linked transaction (see §5.4).

### 3.2 Sale payment (`Order.orderType = VENDA`) → **entry**

- One transaction **per payment** (a sale may have several payments).
- `amount` = `Payment.amount` (the amount charged to the client).
- `transactionDate` = `Payment.paidAt`.
- `type = RECEITA`, `origin = VENDA`, default category **"Vendas"**, linked to the order and the payment.
- **Exception — InfinitePay:** when `Payment.paymentType = INFINITE_PAY`, **no automatic
  transaction is created**. The money only enters on redemption (§3.3).

### 3.3 InfinitePay redemption (`resgate`) → **entry**

- The user triggers an explicit action on a sale (or on the ledger) informing:
  - the redeemed amount (`amount`);
  - the redemption date (`transactionDate`);
  - optional notes.
- `type = RECEITA`, `origin = RESGATE_INFINITEPAY`, default category **"Vendas"**,
  linked to the sale (`orderId`), `paymentId = null`.
- Multiple redemptions per sale are allowed (the user may redeem in parts).
- The linked payment(s) hold the gross charged amount; the implicit gateway fee is
  informative only (`sum(payment.amount) − resgate`).

### 3.4 Payments on dōTERRA orders (`COMPRA`) → **no transaction**

- **Confirmed:** payments registered against a `COMPRA` (dōTERRA) order do **not** create
  any transaction in the finances module. Only `VENDA` payments feed the ledger (§3.2).
- The dōTERRA order itself still produces a single exit (§3.1), regardless of any payments
  recorded against it.

### 3.5 dōTERRA bonus and other manual entries

- **Bônus dōTERRA**: manual income, category "Bônus dōTERRA", no link.
- **Operational expenses** (materials, events, marketing, etc.): manual exit, chosen category.
- Manual entries can be edited/deleted freely; automatic entries cannot (§7.5).

### 3.6 Fee handling

- `Payment.netAmount` stays the source of truth for the gateway fee; the fee remains
  **derived** (`amount − netAmount`) via `backend/src/utils/paymentFee.js` and is **never
  persisted**.
- The ledger does **not** store a fee column and does **not** create fee transactions.
- When a ledger row is linked to a payment, the API may include the derived
  `feeAmount` as **informative** data for the UI (mirroring the payments response).

---

## 4. Domain model

```text
FinancialCategory (per user)
  ├── name, type (RECEITA | DESPESA), isDefault, active
  └── referenced by FinancialTransaction.categoryId (optional)

FinancialTransaction (per user)
  ├── type    RECEITA | DESPESA
  ├── origin  VENDA | RESGATE_INFINITEPAY | PEDIDO_DOTERRA | MANUAL
  ├── amount, description, transactionDate, notes
  ├── categoryId  -> FinancialCategory?   (SetNull on delete)
  ├── orderId     -> Order?               (Cascade on delete)
  └── paymentId   -> Payment?             (Cascade on delete; unique)
```

- A transaction is always born settled; there is no `status`/`settledAt` in the MVP.
  `transactionDate` is the date the money moved.
- Money is persisted as Prisma `Decimal(10,2)` (project rule) and computed in integer
  cents at the application layer (`toCents`, `fromCents`, `formatBRL`).
- Every query is scoped by `userId`.

---

## 5. Data model (Prisma)

### 5.1 Enums

```prisma
enum FinancialTransactionType {
  RECEITA
  DESPESA
}

enum FinancialOrigin {
  VENDA
  RESGATE_INFINITEPAY
  PEDIDO_DOTERRA
  MANUAL
}
```

### 5.2 `FinancialCategory`

```prisma
model FinancialCategory {
  id        String                   @id @default(uuid())
  userId    String
  name      String
  type      FinancialTransactionType
  isDefault Boolean                  @default(false)
  active    Boolean                  @default(true)
  user      User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions FinancialTransaction[]
  createdAt DateTime                 @default(now())
  updatedAt DateTime                 @updatedAt

  @@unique([userId, type, name])
  @@index([userId])
}
```

### 5.3 `FinancialTransaction`

```prisma
model FinancialTransaction {
  id              String                   @id @default(uuid())
  userId          String
  type            FinancialTransactionType
  origin          FinancialOrigin
  amount          Decimal                  @db.Decimal(10, 2)
  description     String                   @db.VarChar(255)
  transactionDate DateTime                 @db.Date
  notes           String?                  @db.VarChar(2000)
  categoryId      String?
  orderId         String?
  paymentId       String?
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  category  FinancialCategory?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  order     Order?              @relation(fields: [orderId], references: [id], onDelete: Cascade)
  payment   Payment?            @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  createdAt DateTime               @default(now())
  updatedAt DateTime               @updatedAt

  @@unique([paymentId])
  @@index([userId, transactionDate])
  @@index([userId, type])
  @@index([userId, categoryId])
  @@index([orderId])
}
```

### 5.4 Referential behaviour

- `paymentId` is **unique** (nullable): guarantees at most one automatic entry per payment
  and makes the sync idempotent (`upsert`-by-payment). Postgres allows many `NULL`s, so
  manual/dōTERRA/resgate rows are unaffected.
- `orderId`/`paymentId` use `onDelete: Cascade`: automatic entries are derived data with no
  independent meaning, so deleting the order/payment removes them. Manual entries have
  `NULL` links and are untouched.
- `categoryId` uses `onDelete: SetNull`: deleting a category never deletes financial history.
- New back-relations must be added to `User`, `Order`, and `Payment`.

### 5.5 Migration

- Create a Prisma migration (e.g. `add_finances_module`) with the two tables, two enums,
  indexes, and FKs.
- On databases with data use `npx prisma migrate deploy` — never `migrate dev`.
- No rename migrations are involved, so no hand-editing is required.
- Run `npx prisma generate` in the environment that runs the tests.

---

## 6. Backend architecture

### 6.1 Files

```text
backend/src/
├── controllers/financesController.js          # thin HTTP handlers
├── services/
│   ├── financeCategoriesService.js            # category CRUD + ensureDefaultCategories
│   ├── financeTransactionsService.js          # manual CRUD, list, summary, settlements
│   └── financeSyncService.js                  # automatic sync from payment/order (tx-aware)
├── validators/financesValidator.js            # Zod schemas
├── routes/financesRoutes.js                   # mounted at /api/finances
└── utils/
    └── financeDefaults.js                     # default category seed + auto-categorisation map
```

### 6.2 Routes (`/api/finances`, all JWT-protected and user-scoped)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/transactions` | List with filters (`type`, `origin`, `categoryId`, `from`, `to`, `q`) |
| POST | `/transactions` | Create **manual** entry |
| PUT | `/transactions/:id` | Update **manual** entry only |
| DELETE | `/transactions/:id` | Delete **manual** entry only |
| POST | `/settlements` | Register an InfinitePay redemption for a sale |
| GET | `/summary` | Totals for the filtered period (`totalIncome`, `totalExpense`, `balance`) |
| GET | `/categories` | List categories (ensures defaults on first access) |
| POST | `/categories` | Create custom category |
| PUT | `/categories/:id` | Rename / deactivate category |
| DELETE | `/categories/:id` | Soft-deactivate category |

- Follow the existing controller pattern: thin handlers, `handleError`, Zod validation in
  `validators/`.
- Reuse `utils/money.js` (`toCents`, `fromCents`) for every monetary calculation.
- Parse `YYYY-MM-DD` with `utils/date.js` (`parseLocalDate`) — never `new Date('YYYY-MM-DD')`.

### 6.3 Manual transaction payload

```json
{
  "type": "RECEITA | DESPESA",
  "amount": 123.45,
  "description": "Bônus dōTERRA",
  "transactionDate": "2026-09-19",
  "categoryId": "uuid-or-null",
  "notes": "optional"
}
```

- `amount` must be > 0.
- `categoryId`, when present, must belong to the user and match the transaction `type`.
- Manual rows get `origin = MANUAL`, `orderId = null`, `paymentId = null`.

### 6.4 InfinitePay settlement payload

```json
{ "orderId": "uuid", "amount": 613.12, "transactionDate": "2026-09-19", "notes": "optional" }
```

- Validate the order belongs to the user, is `orderType = VENDA`, is not a team order, and
  has at least one `INFINITE_PAY` payment.
- `amount` must be > 0.
- Creates a `RESGATE_INFINITEPAY` income row linked to `orderId`.

### 6.5 Listing and summary

- `GET /transactions` returns rows ordered by `transactionDate` desc, then `createdAt` desc,
  with the category and (when linked) the payment's derived `feeAmount` for display.
- Follow the repo's existing pagination conventions where applicable (see
  `backend/tests/pagination.test.js`); if pagination is applied, `GET /summary` must compute
  totals server-side over the **whole filtered set**, not the current page.
- `GET /summary` uses the same filters as `GET /transactions`.

### 6.6 Default categories (`utils/financeDefaults.js`)

```text
RECEITA: Vendas | Bônus dōTERRA | Reembolso | Outras receitas
DESPESA: Compra de produtos dōTERRA | Frete | Taxas de gateway |
         Material de escritório | Eventos | Marketing | Outras despesas
```

- `ensureDefaultCategories(userId, client)` is **idempotent** (upsert by `[userId, type, name]`).
- Called: (a) lazily on `GET /finances/categories`, (b) on user registration
  (`authController.register`), and (c) via a one-off backfill for existing users (a small
  script or a guarded pass in `prisma/seed.js`).
- Auto-categorisation map (origin → default category name):
  - `VENDA` → "Vendas"
  - `RESGATE_INFINITEPAY` → "Vendas"
  - `PEDIDO_DOTERRA` → "Compra de produtos dōTERRA"
  - `MANUAL` → no default; the user picks.

---

## 7. Automatic sync rules

`financeSyncService.js` receives the active Prisma `tx` and runs **inside the same
transaction** as the payment/order write, preserving transactional consistency.

### 7.1 `syncIncomeFromPayment(tx, { userId, payment, order })`

- Skip when the order is **not** a sale (`order.orderType !== 'VENDA'`). Payments on
  `COMPRA` (dōTERRA) orders never create a transaction (§3.4).
- Skip when the order is a team order.
- Skip when `payment.paymentType === 'INFINITE_PAY'` (redemption is manual).
- Otherwise upsert the income row keyed by `paymentId`:
  - `type = RECEITA`, `origin = VENDA`
  - `amount = payment.amount`
  - `transactionDate = payment.paidAt`
  - `categoryId = "Vendas"` (looked up by name/type for the user)
  - `description = "Venda <orderNumber> — <client name>"`
  - `orderId = order.id`, `paymentId = payment.id`

### 7.2 `syncExpenseFromOrder(tx, { userId, order })`

- Only for `orderType = COMPRA` and `isTeamOrder = false`.
- Upsert one exit row keyed by `orderId + origin = PEDIDO_DOTERRA`:
  - `type = DESPESA`, `origin = PEDIDO_DOTERRA`
  - `amount = order.doterraValue ?? order.totalValue`
  - `transactionDate = order.orderDate`
  - `categoryId = "Compra de produtos dōTERRA"`
  - `description = "Pedido dōTERRA <orderNumber>"`
  - `orderId = order.id`, `paymentId = null`
- When the order becomes a team order, delete the linked row.

### 7.3 Hooks

- `services/paymentsService.js` — call `syncIncomeFromPayment` in `createPayment` and
  `updatePayment` (after the payment write, before returning).
  - If an update changes the type **to** `INFINITE_PAY`, delete the linked income row.
  - If it changes **from** `INFINITE_PAY` to another type, create the income row.
  - If the amount/date changes, re-sync the row.
- `services/ordersService.js` — call `syncExpenseFromOrder` after creating/updating a
  `COMPRA` order; delete the row when the order is deleted (FK cascade also covers deletion,
  but keep the service explicit for team-order toggles).
- `services/salesService.js` — sales are `VENDA` orders, so they only produce entries via
  payments; no extra hook beyond `paymentsService`.

### 7.4 Deletion / status interplay

- Deleting an order cascades to its payments and to the linked automatic ledger rows.
- Deleting a payment is not exposed today; if added later, the `paymentId` FK cascade
  removes the income row.
- Editing an automatic row's amount directly is **not** allowed (it is derived from its
  source); the user edits the payment/order instead.

### 7.5 Edit/delete policy

- `PUT`/`DELETE /transactions/:id` accept **manual rows only** (`origin = MANUAL`);
  automatic rows are rejected with `400`.
- Manual rows are fully editable/deletable.

---

## 8. Frontend architecture

Follow `frontend/docs/frontend-architecture-guide.md`. The finances page qualifies as
**Level 3 (page orchestrator)**.

```text
frontend/src/pages/FinancesPage.jsx          # one-line shim re-export
frontend/src/pages/Finances/
├── index.jsx                                # orchestrator (state wiring, modals)
├── useFinances.js                           # list, filters, summary, CRUD, settlement
├── useFinanceCategories.js                  # category list + CRUD
├── components/
│   ├── FinancesSummary.jsx                  # income / expense / balance cards
│   ├── FinancesToolbar.jsx                  # filters (type, origin, category, period, search)
│   ├── FinancesTable.jsx                    # responsive table + row actions
│   ├── FinancialTransactionModal.jsx        # manual create/edit (shared Modal)
│   ├── FinancialCategoryModal.jsx           # category management
│   └── GatewaySettlementModal.jsx           # InfinitePay redemption (CurrencyInput + date)
└── utils/
    └── financeHelpers.js                    # pure formatters, labels, filter builders
```

### 8.1 Conventions to respect

- Use the shared `components/Modal.jsx` for every dialog (z-index `z-[60]`, polite close,
  `isDirty` via `hooks/useDirtyForm.js`, render-prop children).
- Use `components/CurrencyInput` for monetary fields.
- Use semantic tokens only (`bg-surface`, `border-line`, `text-ink`, `accent`, `success`,
  `warning`, `danger`) — no raw palette/hex. Put any badge/status maps in
  `utils/badgeStyles.js`.
- `index.jsx` must not call `api.*` directly; that lives in the hooks.
- Entry/exit badges: RECEITA → `success`, DESPESA → `danger` (via `badgeStyles.js`).

### 8.2 Navigation and routes

- Add a nav item **"Finanças"** (`Wallet` or `Landmark` from lucide-react) pointing to
  `/finances` in `frontend/src/utils/navigation.js`.
- Add `<Route path="/finances" element={<FinancesPage />} />` in `App.jsx`.
- Change the index redirect `/` from `/products` to `/finances` (after the dashboard is
  removed — see Phase F7).

### 8.3 InfinitePay redemption entry point

- On the **Sales** page, expose a "Registrar resgate InfinitePay" action for sales that have
  at least one `INFINITE_PAY` payment.
- The modal collects amount + date + notes and calls `POST /api/finances/settlements`.
- Optionally surface the same action from the ledger page for convenience.

---

## 9. Dashboard removal (Phase F7)

Remove the current dashboard, since it will be replaced by future reports.

**Frontend**

- Delete `frontend/src/pages/Dashboard/` and `frontend/src/pages/DashboardPage.jsx`.
- Remove the `/dashboard` route and the `DashboardPage` import from `App.jsx`.
- Remove the Dashboard nav item from `utils/navigation.js`.
- Remove the dashboard steps from `components/OnboardingTour.jsx`.
- Update/remove tests: `DashboardPage.test.jsx`, `BalanceChart.test.jsx`,
  `App.test.jsx`, `Header.test.jsx`, `navigation.test.js`.
- `frontend/src/utils/exportExcel.js` is only used by the dashboard. **Confirmed: keep the
  utility and its test dormant** so future reports can reuse it — remove only its caller
  (`useDashboard`).

**Backend**

- Remove `routes/dashboardRoutes.js`, `controllers/dashboardController.js`,
  `utils/dashboardProjection.js`, and the `/api/dashboard` mount in `app.js`.
- Remove `tests/dashboard.test.js` and `tests/dashboardProjection.test.js`.
- Remove the `Dashboard` tag and `DashboardSummary` schema from `docs/swagger.js`, and drop
  "dashboard" from the API description string.

> Verify no other module imports `buildDashboardSummary`/`dashboardProjection` before
> deleting (current grep shows only the controller and its tests).

---

## 10. Phase breakdown

Each phase is self-contained and ends with the project verification commands:

```text
cd backend && npm run test
cd frontend && npm run test
npm run lint
npm run format:check
cd frontend && npm run build        # for frontend phases
```

Write tests **before** business logic (project rule for phases 5+). Keep money in integer
cents. Scope every query by `userId`. Use Conventional Commits per phase.

---

### Phase F1 — Data model, migration, and default categories

**Goal:** introduce the schema and the default-category machinery. No endpoints yet.

**Depends on:** nothing.

**Deliverables**

- `backend/prisma/schema.prisma`: enums `FinancialTransactionType`, `FinancialOrigin`;
  models `FinancialCategory`, `FinancialTransaction`; back-relations on `User`, `Order`,
  `Payment`.
- New migration `add_finances_module`.
- `backend/src/utils/financeDefaults.js` with the default category list, the
  origin→category map, and an idempotent `ensureDefaultCategories(userId, client)`.
- `authController.register` calls `ensureDefaultCategories` for the new user.
- One-off backfill for existing users (small script under `backend/scripts/` or a guarded
  block in `prisma/seed.js`).
- `backend/tests/financeDefaults.test.js` — defaults are created once, are idempotent,
  and do not duplicate on a second call.

**Steps**

1. Write `financeDefaults.test.js` first.
2. Edit the schema, run `npx prisma generate`, create the migration.
3. Implement `financeDefaults.js` and wire registration + backfill.

**Acceptance criteria**

- Migration applies cleanly on an empty DB and on a DB with data (`migrate deploy`).
- A new user ends up with the default categories; calling ensure twice creates no duplicates.
- Existing users are backfilled exactly once.

**Suggested commits:** `test(finances): cover default financial categories`,
`feat(finances): add finance schema and default categories`.

---

### Phase F2 — Backend: categories CRUD

**Goal:** expose category management endpoints.

**Depends on:** F1.

**Deliverables**

- `validators/financesValidator.js` (category schemas).
- `services/financeCategoriesService.js`: list, create, update, soft-deactivate;
  `ensureDefaultCategories` on first list.
- `controllers/financesController.js` (category handlers).
- `routes/financesRoutes.js` mounted at `/api/finances` in `app.js`.
- Tests: `backend/tests/financeCategories.test.js`.

**Rules**

- Unique `[userId, type, name]`; reject duplicates with `409`/`400`.
- Cannot rename/deactivate a category in a way that breaks the default set unexpectedly;
  deactivation is soft (`active = false`).
- All reads scoped by `userId`; another user's category returns `404`.

**Acceptance criteria**

- CRUD works, is user-isolated, and defaults are guaranteed on first access.
- Custom categories can be created for both `RECEITA` and `DESPESA`.

**Suggested commits:** `test(finances): cover finance categories API`,
`feat(finances): add finance categories endpoints`.

---

### Phase F3 — Backend: manual transactions, listing, and summary

**Goal:** manual ledger CRUD, filtered listing, and period totals.

**Depends on:** F1, F2.

**Deliverables**

- `services/financeTransactionsService.js`: create/update/delete manual rows, list with
  filters, summary.
- Validators + controller handlers + routes for `/transactions` and `/summary`.
- Tests: `backend/tests/financeTransactions.test.js`.

**Rules**

- `amount > 0`; `categoryId` must belong to the user and match `type`.
- Only `origin = MANUAL` rows are editable/deletable.
- Filters: `type`, `origin`, `categoryId`, `from`, `to`, `q` (description/notes).
- Summary returns `totalIncome`, `totalExpense`, `balance` (in cents or as fixed strings,
  consistent with the rest of the API).

**Acceptance criteria**

- Manual CRUD is user-isolated and validated.
- Listing filters combine correctly; summary matches the filtered set.
- Attempting to edit/delete an automatic row is rejected.

**Suggested commits:** `test(finances): cover manual transactions and summary`,
`feat(finances): add manual transactions and summary endpoints`.

---

### Phase F4 — Backend: automatic integration

**Goal:** feed the ledger from sales payments and dōTERRA orders, plus the InfinitePay
redemption action.

**Depends on:** F1–F3.

**Deliverables**

- `services/financeSyncService.js` with `syncIncomeFromPayment`, `syncExpenseFromOrder`,
  and removal helpers.
- Hooks in `paymentsService.js` and `ordersService.js` (inside the existing `$transaction`).
- `POST /api/finances/settlements` (service + validator + controller + route).
- Tests: `backend/tests/financeSync.test.js` and
  `backend/tests/financeSettlements.test.js`.

**Rules**

- Only payments on **`VENDA`** orders feed the ledger. Payments on `COMPRA` (dōTERRA)
  orders create **no** transaction (§3.4).
- Non-InfinitePay sale payment → one income row per payment (unique `paymentId`).
- InfinitePay sale payment → **no** income row; redemption creates a linked income row.
- dōTERRA `COMPRA` order → one exit row (team orders excluded).
- Payment edit re-syncs the row; switching to InfinitePay removes it.
- Deleting the order/payment removes the linked rows (FK cascade).
- Settlement validates ownership, `VENDA`, non-team, and presence of an `INFINITE_PAY` payment.

**Acceptance criteria**

- Creating a PIX/dinheiro payment on a sale produces exactly one income row with the right
  amount/date.
- Creating a payment on a dōTERRA (`COMPRA`) order produces **no** ledger row.
- An InfinitePay payment produces none until a redemption is registered.
- Creating/updating a dōTERRA order keeps exactly one exit row in sync.
- Editing a payment updates its row; deleting an order removes its rows.
- Everything stays inside the source write transaction (no partial writes).

**Suggested commits:** `test(finances): cover automatic ledger sync`,
`feat(finances): sync ledger from payments and dōTERRA orders`,
`feat(finances): add InfinitePay settlement endpoint`.

---

### Phase F5 — Frontend: categories management

**Goal:** let the user list, create, edit, and deactivate categories.

**Depends on:** F2 (backend) — can be built in parallel with F3/F4.

**Deliverables**

- `pages/Finances/useFinanceCategories.js`.
- `pages/Finances/components/FinancialCategoryModal.jsx` (uses shared `Modal`).
- Tests: `frontend/tests/FinanceCategories.test.jsx`.

**Acceptance criteria**

- Default categories are listed; custom ones can be created for both types.
- Validation errors are shown; deactivation works; modal follows the shared Modal contract.

**Suggested commits:** `test(finances): cover category management UI`,
`feat(finances): add finance category management`.

---

### Phase F6 — Frontend: cash-flow page and manual entries

**Goal:** the ledger screen with filters, totals, manual entry, and the redemption action.

**Depends on:** F3, F4, F5.

**Deliverables**

- `pages/FinancesPage.jsx` (shim) + `pages/Finances/` orchestrator, hooks, components, and
  `utils/financeHelpers.js` (per §8).
- Nav item + route (§8.2); index redirect still points to `/products` until F7.
- Redemption action on the Sales page for sales with InfinitePay payments (§8.3).
- Tests: `frontend/tests/FinancesPage.test.jsx`, `frontend/tests/FinancesSettlement.test.jsx`,
  and helper unit tests.

**Acceptance criteria**

- Totals and the table reflect the filters.
- Manual create/edit/delete works with currency masks and the polite-close modal.
- Linked rows show a link/indicator to the originating order/payment.
- InfinitePay redemption creates the linked income row and updates the list.
- `npm run build` and `format:check` are clean.

**Suggested commits:** `test(finances): cover cash-flow page`,
`feat(finances): add cash-flow page and manual entries`,
`feat(sales): add InfinitePay redemption action`.

---

### Phase F7 — Remove the dashboard

**Goal:** delete the dashboard now, in preparation for future reports.

**Depends on:** F6 (so `/finances` exists before the index redirect changes).

**Deliverables**

- Frontend and backend removals listed in §9.
- Index redirect `/` → `/finances`.
- Resolve the `exportExcel.js` decision (§12).
- Tests updated/removed accordingly.

**Acceptance criteria**

- No references to `/dashboard`, `DashboardPage`, `dashboardRoutes`,
  `dashboardProjection`, or `buildDashboardSummary` remain in `src/` or `tests/`.
- The app boots, redirects to `/finances`, and the full suite passes.

**Suggested commits:** `refactor(frontend): remove dashboard in favor of finances`,
`refactor(backend): remove dashboard endpoints and projection`.

---

## 11. Documentation and housekeeping

- Update `ARCHITECTURE.md`: repository structure, domain model (`FinancialTransaction`,
  `FinancialCategory`), and the new `/api/finances` endpoints; remove the dashboard
  references when F7 lands.
- Update `docs/swagger.js`: add the `Finances` tag and schemas; remove `Dashboard` in F7.
- Update `AGENTS.md` only if commands, dependencies, or constraints change.
- Follow the `NOTES.md` → `CHANGELOG.md` workflow after each phase; never commit `NOTES.md`.
- Keep `frontend/docs/frontend-architecture-guide.md` compliance for every frontend change.
- After changing any design token, run `node scripts/contrast-check.mjs` in `frontend/`.

---

## 12. Resolved decisions and remaining open items

Resolved:

1. **Reimbursement income on `COMPRA` payments (§3.4).** Confirmed **no** — payments on
   dōTERRA orders create no transaction; only `VENDA` payments feed the ledger.
2. **`exportExcel.js` in F7.** Confirmed **keep dormant** — keep the utility and its test,
   remove only the dashboard caller.
3. **Multiple redemptions per sale.** Allowed (partial redemptions).
4. **Editing automatic rows.** Blocked; edit the source payment/order instead.
5. **Category deletion.** Soft-deactivate (`active = false`) to preserve history.
6. **dōTERRA expense value.** `doterraValue ?? totalValue` (equal today), one row per order,
   freight included.
7. **Pagination on `/transactions`.** Confirmed **full filtered set** for the MVP (no
   pagination); `GET /summary` therefore totals the whole filtered set by construction,
   ready to add pagination later without changing the summary contract.

Remaining open: none.

---

## 13. Verification checklist (per phase)

```text
[ ] Tests written first and passing (backend and/or frontend)
[ ] cd backend && npm run test
[ ] cd frontend && npm run test
[ ] npm run lint
[ ] npm run format:check
[ ] cd frontend && npm run build            (frontend phases)
[ ] npx prisma generate                     (after schema changes)
[ ] npx prisma migrate deploy               (data-bearing DBs)
[ ] ARCHITECTURE.md / swagger updated       (when scope changes)
[ ] NOTES.md updated, never staged
[ ] Conventional commit(s), scoped per phase
```
