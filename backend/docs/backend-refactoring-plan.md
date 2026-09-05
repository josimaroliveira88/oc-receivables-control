# Backend Refactoring Plan

This document records the ordered phases that will transform the current `backend/src/` layout to match `backend/docs/backend-architecture-guide.md`. Each phase is intentionally small enough to land in a single pull request and easy to revert.

The phases run from the smallest, most isolated controller to the largest, so the playbook is validated on simple cases before it touches `ordersController.js`.

## Conventions used in every phase

- **Public surface preserved.** Controllers keep exporting the same handler names so `routes/*` and existing tests do not change.
- **Behavior preserved.** No HTTP response payload, status code, JSON key order, or Zod validation message changes.
- **Shared helpers unchanged.** `utils/receivables.js`, `utils/kitStock.js`, `utils/stockDiff.js`, `utils/money.js`, and `utils/search.js` must keep the same exports (signatures may grow when a phase adds a new shared function, e.g. R3 extending `receivables.js`).
- **Verification.** After each phase: `npm run test` (in `backend/`) and `npm run format:check` (root).
- **TDD for new helpers.** Whenever a phase introduces a genuinely new pure helper (not a pure move of existing code), a focused unit test is added in `backend/tests/` before the helper is wired in. Pure moves of existing code rely on the existing integration suite.
- **Run base before touching.** Phase R9 may only start once R1–R8 are merged and the full backend suite is green.

## Target end-state tree

```text
backend/src/
├── controllers/
│   ├── ordersController.js          # thin handlers
│   ├── orders/                      # removed (handler-only after R9)
│   ├── salesController.js           # thin handlers
│   ├── peopleController.js
│   ├── paymentsController.js
│   ├── stockController.js           # renamed from StockController.js
│   ├── productController.js
│   ├── orderAttachmentsController.js
│   ├── dashboardController.js
│   └── authController.js
├── services/
│   ├── stockService.js              # already exists; reused by all phases
│   ├── stockUndoService.js          # R4
│   ├── ordersService.js             # R9
│   ├── orderStockIntegration.js     # R9
│   ├── salesService.js              # R8
│   ├── paymentsService.js           # R6
│   └── kitValidationService.js      # R7
├── validators/
│   ├── authValidator.js             # R1
│   ├── stockValidator.js            # R4
│   ├── peopleValidator.js           # R5
│   ├── paymentsValidator.js         # R6
│   ├── productValidator.js          # R7
│   ├── ordersValidator.js           # R9
│   └── salesValidator.js            # R8
├── utils/
│   ├── attachmentStorage.js         # R2
│   ├── classification.js            # R5
│   ├── dashboardProjection.js       # R3
│   ├── orderBalances.js             # R3 / R6
│   ├── productsProjection.js        # R7
│   ├── productSort.js               # R7
│   ├── pagination.js                # R7
│   ├── ordersSort.js                # R9
│   ├── ordersHelpers.js             # R9
│   ├── salesHelpers.js              # R8
│   ├── httpError.js                 # R10
│   ├── money.js                     # unchanged
│   ├── kitStock.js                  # unchanged
│   ├── stockDiff.js                 # unchanged
│   ├── search.js                    # unchanged
│   ├── receivables.js               # extended in R3
│   ├── paymentTypes.js              # unchanged
│   ├── date.js                      # unchanged
│   ├── csvParser.js                 # unchanged
│   └── productLoader.js             # unchanged
├── routes/                          # unchanged: thin one-level files
├── middlewares/                     # unchanged
└── config/
    ├── database.js                  # reused everywhere after R10
    └── config.js                    # unchanged
```

## Phases at a glance

| Phase | Controller (current lines) | Files created | Highlights |
| --- | --- | --- | --- |
| R1 | `controllers/authController.js` (101) | `validators/authValidator.js` | Smallest controller; validates the playbook first. |
| R2 | `controllers/orderAttachmentsController.js` (140) | `utils/attachmentStorage.js` | Filesystem helpers (`attachmentMaxBytes`, `removeAttachmentFile`, `resolveAttachmentPath`). |
| R3 | `controllers/dashboardController.js` (164) | `utils/dashboardProjection.js`, `utils/orderBalances.js`; extend `utils/receivables.js` | Extracts KPI/balance builders; deduplicates against `paymentsController.getOrderBalance` and `peopleController.getPersonSummary`. |
| R4 | `controllers/StockController.js` (288, capital S) | rename to `stockController.js`; `validators/stockValidator.js`; `services/stockUndoService.js` | Renames the file to match naming convention; moves undo-last-movement + orderId-lock to a service. |
| R5 | `controllers/peopleController.js` (349) | `validators/peopleValidator.js`, `utils/classification.js` | IsValidBirthday + classification map extracted; uses shared person-summary helper from R3. |
| R6 | `controllers/paymentsController.js` (350) | `validators/paymentsValidator.js`, `services/paymentsService.js`, `utils/orderBalances.js` (consumed) | Payment post-write status recalc moves to service; `getOrderBalance` delegates to the shared util. |
| R7 | `controllers/productController.js` (542) | `validators/productValidator.js`, `services/kitValidationService.js`, `utils/productsProjection.js`, `utils/productSort.js`, `utils/pagination.js` | Kit validation, current-price projection, sort, and pagination become separate modules. |
| R8 | `controllers/salesController.js` (839) | `validators/salesValidator.js`, `services/salesService.js`, `utils/salesHelpers.js` | Mirrors the orders shape; kit/sale integration isolated. |
| R9 | `controllers/ordersController.js` (1403) | `validators/ordersValidator.js`, `services/ordersService.js`, `services/orderStockIntegration.js`, `utils/ordersHelpers.js`, `utils/ordersSort.js` | The largest controller; consolidates everything the playbook describes. |
| R10 | cross-cutting | `utils/httpError.js`; update imports | Reuses `config/database.js` everywhere; replaces inline `badRequest` pattern; updates `ARCHITECTURE.md`. |

---

## Phase R1 — `controllers/authController.js`

- Pre-condition: full backend suite is green on `main`.
- New file `backend/src/validators/authValidator.js` exporting `loginSchema` and `registerSchema` (copied verbatim, including messages).
- `controllers/authController.js` requires the validator module and drops the inline `z.object(...)` definitions; everything else stays.
- Exports `{ login, register }` unchanged.
- Verification: `tests/auth.test.js` passes (4 tests); `npm run format:check` clean.

## Phase R2 — `controllers/orderAttachmentsController.js`

- New file `backend/src/utils/attachmentStorage.js` with `DEFAULT_MAX_BYTES`, `attachmentMaxBytes`, `removeAttachmentFile`, plus the extension map for the `Content-Type` header. Keep behavior identical (including the silent ENOENT suppression on `removeAttachmentFile`).
- `controllers/orderAttachmentsController.js` deletes the now-shared helpers and only keeps `findOwnedOrder`, `uploadAttachment`, `getAttachment`, `deleteAttachment`. The export still includes `removeAttachmentFile` because `ordersController.deleteOrder` calls it (require is updated in R9 if this export is removed; alternatively a thin re-export remains).
- Verification: `tests/ordersAttachments.test.js` passes (14 tests).

## Phase R3 — `controllers/dashboardController.js`

- New `backend/src/utils/orderBalances.js` exposing `buildOrderBalances(order)` (extracted from `paymentsController.getOrderBalance`); consumes `lineValueCents`, `toCents`, `fromCents`, and `receivables.computeOrderStatus` rules for `isSelf` → pending `0`.
- New `backend/src/utils/dashboardProjection.js` with `buildDashboardSummary(orders, allPayments, { currentDate })` returning `{ totalPending, totalPaid, currentMonthReceipts, personBalances, yearlyBreakdown }`. Self-person exclusion (already the rule) and team-order exclusion (still the `where isTeamOrder: false` in the controller) are preserved.
- Extend `backend/src/utils/receivables.js` with `summarizeOrderForDashboard(order)` and `summarizePaymentsForMonth(payments, date)` only if the projection module would otherwise grow; otherwise the local functions in `dashboardProjection.js` stay there.
- `controllers/dashboardController.js` becomes a thin handler that fetches, calls the projection util, and responds.
- Verification: `tests/dashboard.test.js` (49 tests) and `tests/payments.test.js` tests covering `getOrderBalance` pass unchanged.

## Phase R4 — `controllers/StockController.js`

- Rename `controllers/StockController.js` → `controllers/stockController.js`. Update the single import in `routes/stockRoutes.js` to `require('../controllers/stockController')`.
- New `validators/stockValidator.js` with `movementSchema` (Zod).
- New `services/stockUndoService.js` exporting `undoLastMovement(client, { id, userId })` encapsulating the "only the last movement can be undone", `orderId` lock, `Inventory` delete-when-empty rule, and negative-stock rejection. Returns `{ movement, inventory }`. Adds unit tests targeting the rule branches (last-movement, orderId-locked, would-go-negative) using a stub `client`; existing integration tests in `tests/stock.test.js` continue to validate the end-to-end path.
- `controllers/stockController.js` keeps `listInventory`, `getProductHistory`, `registerMovement`; `undoLastMovement` becomes a thin wrapper that calls the service.
- Verification: `tests/stock.test.js`, `tests/ordersStock.test.js`, `tests/stockDiff.test.js`, and `tests/kitStock.test.js` all pass.

## Phase R5 — `controllers/peopleController.js`

- New `validators/peopleValidator.js` with `personSchema`, `MAX_DAYS_BY_MONTH`, `isValidBirthday`. Messages remain identical.
- New `utils/classification.js` with `SORTABLE_PERSON_FIELDS` (or kept inline if only `classificationToFlags` is meaningful; otherwise both move).
- `getPersonSummary` delegates the totals computation to a new shared helper co-located with R3 (`receivables.personFinancialSummary(items, payments, { isSelf })`) that returns `ordersCount, totalItemsCents, totalPaidCents, totalOpenCents`.
- Controller becomes `getPeople`, `getPersonById`, `getPersonSummary`, `createPerson`, `updatePerson`, `getOrCreateSelfPerson`, `deletePerson`.
- Verification: `tests/people.test.js` passes (≈61 tests at the time of writing).

## Phase R6 — `controllers/paymentsController.js`

- New `validators/paymentsValidator.js` with `paymentSchema` and `updatePaymentSchema`.
- New `services/paymentsService.js` with `createPayment(client, { userId, orderId, payload })` and `updatePayment(client, { id, userId, payload })` performing the `$transaction`, the self/total amount check (`itemSumCents > 0 && amountCents === 0`), and the `computeOrderStatus` call (the new payment is added explicitly because the transaction's `order.payments` read is stale). Throws errors with `.status` via the shared helper from R10; for R6 the controller keeps translating the messages until R10.
- `getOrderBalance` delegates to `utils/orderBalances.js#buildOrderBalances` introduced in R3.
- Controller handlers shrink to validation, service call, response.
- Verification: `tests/payments.test.js` (~115 tests) and `tests/salesPayments.test.js` (12 tests).

## Phase R7 — `controllers/productController.js`

- `validators/productValidator.js` with `productStatusSchema`, `productTypeSchema`, `componentSchema`, `createProductSchema`, `updateProductSchema`.
- `services/kitValidationService.js` with `validateKitComponents(client, { productId, productType, components })`. Receives a Prisma client so it can run inside a future `$transaction` even though today it runs only at create/update.
- `utils/productsProjection.js` with `projectCurrentPrice`, `priceFieldsPresent`, `priceFieldsEqual`.
- `utils/productSort.js` with `sortProducts`, `SORTABLE_FIELDS`, `NUMERIC_SORT_FIELDS`.
- `utils/pagination.js` with `paginate(items, { page, pageSize, maxPageSize = 100, defaultPageSize = 20 })` returning `{ data, pagination }`. Catalog product ownership doesn't change, so the `userId` scope stays on the controller query.
- Verification: `tests/products.test.js`, `tests/kitProducts.test.js`, `tests/productLoader.test.js` all pass.

## Phase R8 — `controllers/salesController.js`

- `validators/salesValidator.js` with `saleItemSchema`, `createSaleSchema`, `updateSaleSchema`, and `BAD_REQUEST_MESSAGE` strings preserved.
- `services/salesService.js` with `nextSaleNumber(client, userId)` (the `P2002` retry loop), `resolveSaleKitFields`, `resolveSaleUpdateItems`, plus `createSale`, `updateSale`, `deleteSale`, `getSales`, `getSaleById`. Each transaction-bound function receives `client` first.
- `utils/salesHelpers.js` with `validateSaleProducts`, and the in-memory search/sort glue (currently inline in `getSales`).
- Verification: `tests/sales.test.js`, `tests/salesStock.test.js`, `tests/salesPayments.test.js` pass.

## Phase R9 — `controllers/ordersController.js`

- `validators/ordersValidator.js` with `itemSchema`, `orderDescriptiveSchema`, `createOrderSchema`, `updateOrderSchema`.
- `services/ordersService.js` with `createOrder`, `updateOrder`, `deleteOrder`, `addItemToOrder`, `updateItem`, `deleteItem`, `getOrders`, `getOrderById`. Each handler binds to a Prisma client and delegates to the service.
- `services/orderStockIntegration.js` with `itemStockMovements(client, { order, items })` returning the per-product `[{ productId, delta }]` plus reason/date — extracted verbatim from the controller. Uses `applyMovement` from `services/stockService.js` and `computeStockDiff` from `utils/stockDiff.js`. The controller's `computeStockDiff` import points here.
- `utils/ordersHelpers.js` with `validateProducts`, `validateStockItemRules`, `selfPersonIdSet`, `assertNotSaleOrder`, `itemCreateData`, `resolveKitFields`, `resolveEditedKitFields`, `resolveOrderUpdateItems`, `orderLineTotalCents`, `statusItemFromItem`.
- `utils/ordersSort.js` with `ORDER_SORTABLE_FIELDS`, `orderSortValue`, `sortOrdersInMemory`.
- Controller becomes orchestrator: handlers stay thin, exports preserved.
- Verification: `tests/orders.test.js`, `tests/ordersStock.test.js`, `tests/ordersKit.test.js`, `tests/ordersAttachments.test.js`, `tests/payments.test.js`, `tests/dashboard.test.js` all pass.

## Phase R10 — cross-cutting

- New `backend/src/utils/httpError.js` with `badRequest(msg)`, `notFound(msg)`, `forbidden(msg)`. Each returns an `Error` with `.status` set; controllers wrap a single small mapper in their `try`/`catch`.
- Replace `new PrismaClient()` instances in `controllers/ordersController.js`, `controllers/salesController.js`, `controllers/productController.js`, `controllers/paymentsController.js`, `controllers/peopleController.js`, `controllers/orderAttachmentsController.js`, `controllers/authController.js`, and `controllers/dashboardController.js` with `require('../config/database').default` (or the existing singleton `prisma` exported from `config/database.js`, already used by `stockController.js`). Consolidate `prisma` resolution at `config/database.js`.
- Replace inline `const e = new Error(message); e.status = 400; throw e` patterns with the new helpers. `ordersController.js` and `salesController.js` are the biggest offenders; both have a local `badRequest` already.
- Update `backend/package.json` if needed for the new modules (none expected; they are internal CommonJS modules).
- Update `ARCHITECTURE.md` "Repository Structure" tree and the "Important Design Decisions" bullet referencing `applyMovement` to also mention `ordersService`, `salesService`, and the new validator tree.
- Verification: full backend suite (518 tests at last run), `npm run format:check`, and `frontend npm run build` for completeness (no FE impact expected).
