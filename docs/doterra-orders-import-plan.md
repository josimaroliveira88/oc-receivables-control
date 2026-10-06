# dōTERRA Orders Import — Implementation Plan

> Document for an implementing AI agent. Read `AGENTS.md` first — its rules
> (TDD, integer cents, user isolation, migration procedure, commit conventions,
> `NOTES.md` workflow) apply to every item here. This plan is self-contained:
> it includes the dōTERRA page evidence the implementer cannot access, the
> exact data contracts, and the test plan.

## 1. Objective

Evolve the existing Uber-rides Chrome extension (`tools/uber-rides-extension/`)
into a dual-purpose capture tool. When the logged-in user opens the dōTERRA
Back Office order-history page (`Rastreamento de Pedidos e Pacotes`), a
floating box offers to capture the orders listed in the table and send them to
the backend, creating **purchase orders (`Order.orderType = 'COMPRA'`) flagged
`pendingReview`** for the user to review in the app. Orders that already exist
are never touched. Product codes missing from the catalog are auto-registered
as **draft products** (`PENDENTE_CADASTRO`) that the user completes and
activates. Discarding a pending order (delete) removes everything the import
created — including draft products, their stock movements and inventory rows.

User-facing strings (app + extension UI) are PT-BR. Code, comments and docs are
English, per `AGENTS.md`.

## 2. Confirmed decisions (approved by the product owner)

1. **Detail pages are fetched** — but only for orders the backend does not
   have yet (a lookup call runs first). Per-item price, per-item PV,
   description, payment type and installments only exist in the detail page;
   list-only data would produce items with no price.
2. **Unknown product codes become draft products with a new status
   `ProductStatus.PENDENTE_CADASTRO`** (not `INATIVO`), seeded with the
   description/price/PV from the detail page.
3. **Card purchases import as `CARTAO_CREDITO` with installments** (card bill +
   installment transactions are created automatically, exactly like a manual
   registration; first installment date defaults to the order date). And: when
   the user discards a pending imported order, **everything related is deleted
   together** — stock, financial records and the draft products the import
   created (see §6.5).
4. **Capture scope: everything currently in the table**, plus a
   "Carregar mais antigos" button in the box that auto-paginates the page's own
   "Ver mais" flow. Rows with a "Cancelar" link (unpaid) are always excluded.
   Already-imported orders are never touched (idempotent by order number).

## 3. Current-state map (verified in the repo)

### Backend (Express + Prisma + Zod)

- `backend/prisma/schema.prisma`
  - `Order`: `orderType` (`COMPRA`/`VENDA`), `@@unique([orderNumber, userId])`,
    `doterraPv`, `doterraValue`, `installments`, `firstInstallmentAt`,
    `paymentType`, `accountOwner`, `shippingValue`, `orderNotes` (max 2000).
  - `Product`: global catalog (no `userId`), `code @unique`, `status`
    (`ATIVO`/`INDISPONIVEL`/`INATIVO`), `productType` (`SIMPLES`/`KIT`).
  - `ProductPrice`: `regularPrice`, `memberPrice`, `pv`, `validFrom`,
    `validTo` (current price = last row with `validTo: null`).
  - `Item.productId` → `Product` (`SetNull`), `KitComposition` references
    `Product` with `onDelete: Restrict`; `Inventory` (unique per
    `userId`+`productId`) and `StockMovement` also `Restrict`.
- `backend/src/services/ordersService.js` — purchase-order CRUD. `createOrder`
  resolves the self person (`Person.isSelf`), validates products
  (`ATIVO`/`INDISPONIVEL` only — `backend/src/utils/ordersValidation.js`),
  applies `resolveItemDefaults` (**`forStock` defaults to `true` when the item
  has a `productId` and is self-bound** — `backend/src/utils/ordersItemTransform.js`),
  applies stock ENTRADA (`itemStockMovements` → `stockService.applyMovement`),
  syncs the ledger (`syncExpenseFromOrder`: `DESPESA`/`PEDIDO_DOTERRA`, or a
  credit-card bill + installments when `paymentType === 'CARTAO_CREDITO'` —
  `backend/src/services/financeSyncService.js` + `creditCardService.upsertBillForOrder`).
- `backend/src/services/apiTokenService.js` — single `scope` string
  (`API_TOKEN_SCOPES = ['uber:import']`), `authorizeApiToken` compares
  `record.scope !== scope` (exact match).
- `backend/src/middlewares/apiTokenAuth.js` — `authenticateUberImport`
  (session JWT **or** `cr_…` token, dispatch by prefix).
- `backend/src/routes/uberRoutes.js` — route-order pattern: composed
  middleware first, `router.use(authenticateToken)` after.
- `backend/src/validators/ordersValidator.js` — `createOrderSchema` requires
  `installments` + `firstInstallmentAt` when `paymentType === 'CARTAO_CREDITO'`.
- Reference import feature: `backend/src/services/uberRidesService.js`
  (idempotent upsert by `externalId`, per-batch summary).

### Frontend (React 18 + Vite + Tailwind tokens)

- `frontend/src/pages/Orders/` — `OrdersPage` (`index.jsx`), `useOrders`,
  `useOrderFilters`, `components/OrdersTable.jsx`, `OrdersTableToolbar.jsx`,
  `Badges.jsx` (status badges via `frontend/src/utils/badgeStyles.js`).
- `frontend/src/pages/Products/` — `useProducts`, `ProductsTable`,
  `StatusBadgeDropdown`, edit form + status-change confirmation (activation =
  existing flow).
- `frontend/src/pages/UberRides/` — import modal + welcome modal patterns;
  `hooks/useApiTokens.js` (token creation UI state; hardcodes
  `scope: 'uber:import'`).
- `frontend/src/services/apiTokensApi.js` — session-JWT-only token endpoints.
- UI conventions: shared `components/Modal.jsx` (z-index discipline),
  tokenized Tailwind palette only (`badge-*` classes centralized in
  `frontend/src/utils/badgeStyles.js`), `useDirtyForm` for modals.

### Extension (`tools/uber-rides-extension/`, MV3, v0.5.0)

- `manifest.json`: two content scripts on `riders.uber.com` — `src/page/content.js`
  (MAIN world, hooks `fetch`/XHR) and `src/ui/content.js` (ISOLATED world,
  floating box + clipboard + popup bridge). Each file is **deliberately
  self-contained**; the two worlds talk only via `postMessage` tagged
  `uber-rides-capture`.
- `src/background/background.js` — the import POST + "open the app in a new
  tab" (extension-context fetch covered by `host_permissions`; token/server
  URL read from `chrome.storage.local` keys `uber-rides:api-token` /
  `uber-rides:server-url`, default server `http://localhost:3000`).
- `src/popup/popup.js` — token/server persistence + remote capture trigger.
- `scripts/package-extension.mjs` — zipped into the gitignored
  `frontend/public/uber-rides-extension.zip` by the frontend `predev`/`prebuild`
  scripts; served at `/uber-rides-extension.zip`.
- Standing rules from `AGENTS.md`: manifest edits require **remove + re-add**
  in `chrome://extensions`; verify a rebuild via the build label
  (`vX.Y.Z · label`) shown in the box, popup and console; never declare the
  same file path in two `content_scripts` worlds.

## 4. dōTERRA source pages (evidence captured by the product owner)

The implementer has no access to these pages — everything needed is here.

### 4.1 Order list — `evo_Modules.OrderHistoryFull`

URL: `https://office.doterra.com/index.cfm?Fuseaction=evo_Modules.OrderHistoryFull`

- Page heading: `<h3 class="white">Pedidos de <I>Gouveia Lima, Cássia</I></h3>`
  — **account owner** source.
- Hidden cursor for pagination:
  `<input type="hidden" class="startdate" value="202608">`.
- Table: `<table id="OrderHistoryTable">` with rows in
  `<tbody id="OrderhistoryRows">`. Each `<tr>` has, in order:

  | # | Column | Cell content / parse rule |
  |---|--------|---------------------------|
  | 1 | Detalhes do Pedido | `<a href="index.cfm?fuseaction=evo_Modules.OrderInvoice&ODHNumber=185245937">185245937</a>` → order number + detail URL |
  | 2 | Tipo | `I`, `D` or `R` (informational; `R` = reposição, zero value) |
  | 3 | Origem | `AS`, `SO`, `IO`, `IN`, `VO` (informational) |
  | 4 | Enviar Para | Ship-to name, inconsistent format — not used |
  | 5 | Rastreamento | Tracking link or empty — not used |
  | 6 | Item | Product codes separated by `<br>` (may start with a stray `<br>`) |
  | 7 | Qtd | Quantities separated by `<br>`, index-aligned with column 6 |
  | 8 | Link do Boleto | `Abrir Boleto` (pagador.com.br) / `Abrir Pix` (bradesco) link or empty → payment type hint |
  | 9 | Data | Order date `dd/mm/yyyy` |
  | 10 | Data de Envio | `dd/mm/yyyy` or empty — not used |
  | 11 | Data PV | PV month, **unpadded** (`10/2026` or `9/2026`) — informational |
  | 12 | Volume: | total PV — parse `data-sort-value` (plain decimal, e.g. `"155.6"`, `"0"`) |
  | 13 | Valor | total value — parse `data-sort-value` (e.g. `"1097.25"`) |
  | 14 | Cancelar | `<a class="OrderCancelLink" …>Cancelar</a>` **only for unpaid current-month boleto orders — these rows are excluded from capture entirely** |

  Prefer `data-sort-value` over the visible text (no thousands separators,
  no `R$`).

### 4.2 "Ver mais" pagination AJAX

Trigger on the page: `VIEWMORE()` builds

```
index.cfm?Fuseaction=evo_Modules.OrderHistoryFull&SupressDTSPopup=1&PopupDiv=orderhistoryrows&noheader=1&nofooter=1&api=1&no_meta=1&axn=ViewMoreCount&startdate=<$('.startdate').last().val()>&_=<timestamp>
```

GET (same origin, session cookies). Response is an HTML fragment:

```html
<input type="hidden" class="startdate" value="202605">
<table id="ajaxrowstable" style="display:none;">
  <tbody>
    <tr> …same 14-cell structure as the main table… </tr>
  </tbody>
</table>
<script>…popup init…</script>
```

The page's own handler appends the fragment to `<body>`, moves
`#ajaxrowstable tr` into `#OrderhistoryRows`, and removes the table — the
appended hidden `.startdate` becomes the new cursor (decremented by 3 months
per response: `202608` → `202605`). The extension's auto-paginate must
replicate exactly this (append fragment to `document.body`, move rows into
`#OrderhistoryRows` in order, remove `#ajaxrowstable`, keep the hidden input)
so the page's own "Ver mais" link keeps working. Loop guards: stop when the
fragment contains 0 rows, when the returned `startdate` is unchanged, or after
40 iterations (~10 years); ~300 ms delay between fetches.

### 4.3 Order detail — `evo_Modules.OrderInvoice&ODHNumber=<number>`

Same-origin GET (session cookies), relative URL from the list row. Fields:

- Header tables: `Número do pedido`, `Data do pedido` (`dd/mm/yyyy`),
  `Vol do Mês`, `ID do Consultor de Bem-Estar`, `Moeda: R$`.
- Items table (`.ui.basic.segment.tabledivnm table`), header
  `Item | Qtde enviada | Qtde encomendada | Descrição | Volume | Volume total |
  Preço | Preço total`. Per line: code, per-unit PV (`Volume`), per-unit price
  (`Preço`, e.g. `R$ 150.00`), description (may contain `<sup>®</sup>` and
  `<br/>`). **Use `Qtde encomendada`** (ordered, not shipped). The last row is
  a totals row (`colspan` + `<b>Volume total:</b>` / `<b>Subtotal:</b>`) — skip it.
- Totals table: `Frete (Envio Normal) R$ 0.00`, `Imposto … R$ 0.00`,
  `Total a Pagar R$ 1,045.63`, and optionally
  `04 Parcelas de R$ 261.40` → **installment count + installment value**.
- Payment table (`InvoicePayments`): `Tipo de Pagamento` (e.g.
  `Card Payment (CYB)`), `Número do Cartão: ************5331`,
  `Valor recibo`, `Total`, `A Receber`.
- `Faturar para` / `Enviar para` addresses (informational only).

**Money parsing** (both list and detail): values appear as `R$ 150.00` (dot
decimal) and `R$ 1,045.63` (comma thousands + dot decimal). Strip `R$`,
spaces and non-breaking spaces; remove `,` when it groups thousands; treat the
last `,` or `.` followed by exactly 2 digits as the decimal separator. Convert
to a JS number only after normalization (the app's integer-cents rules apply
server-side; the payload carries plain decimal numbers, like every existing
Zod contract).

**Payment-type mapping** (authoritative rule):

| Evidence | `PaymentType` | Extras |
|---|---|---|
| Detail `Tipo de Pagamento` starts with `Card Payment` | `CARTAO_CREDITO` | `installments` from `NN Parcelas de`, `firstInstallmentAt` = order date |
| List row link `Abrir Boleto` | `BOLETO` | — |
| List row link `Abrir Pix` | `PIX` | — |
| None of the above (e.g. `R` reposição) | `null` | — |

## 5. Data contracts

### 5.1 Capture JSON (extension clipboard copy AND import request body)

One schema for both the "capturar e copiar JSON" path (paste in the app) and
the direct POST:

```json
{
  "orders": [
    {
      "orderNumber": "184145362",
      "orderDate": "2026-09-02",
      "accountOwner": "Gouveia Lima, Cássia",
      "listTypeCode": "I",
      "listOriginCode": "AS",
      "pvMonth": "2026-09",
      "doterraPv": 155.9,
      "listValue": 1045.63,
      "paymentType": "CARTAO_CREDITO",
      "installments": 4,
      "installmentValue": 261.4,
      "shippingValue": 0,
      "items": [
        {
          "code": "60209630",
          "description": "10 ml dōTERRA Calmer® Touch Mix Calmante",
          "quantity": 1,
          "unitPrice": 150.0,
          "unitPv": 20.0
        }
      ]
    }
  ]
}
```

- Dates: ISO `YYYY-MM-DD` (the extension converts `dd/mm/yyyy` locally —
  never `new Date('YYYY-MM-DD')` pitfalls; the backend re-parses with
  `parseLocalDate`).
- `listValue`/`doterraPv` are cross-check totals from the list
  (`data-sort-value`); `shippingValue` is the detail's `Frete`.
- Rows with a "Cancelar" link are never included (client-side exclusion; the
  server has no paid/unpaid knowledge — documented decision).
- Real fixture for tests: order `184145362` (2026-09-02, PV 155.90, total
  1045.63, card CYB in 4×261.40, items `60209630/60215519/60208387/60233778/
  60233775/60203413/60203322/60215486/60215533/5025 (Produto do Mês, R$ 0)/
  60205740 (VM Complex, R$ 0)` — note the zero-price promo items).

### 5.2 `POST /api/doterra/orders/lookup`

Auth: session JWT **or** API token with scope `doterra:import` (composed
middleware, mirrors `authenticateUberImport`). Body
`{ "numbers": ["184145362", "…"] }` →
`{ "existing": ["184145362"], "missing": ["185245937"] }`.
"Existing" means **any** `Order` of the user with that `orderNumber`
(regardless of `orderType` — the DB unique is `(orderNumber, userId)`), so a
collision with a manually-typed number can never cause a P2002 on import.

### 5.3 `POST /api/doterra/orders/import`

Auth: same composed middleware. Body = capture JSON (§5.1). Response:

```json
{
  "created": [
    { "orderNumber": "184145362", "id": "<uuid>", "warnings": ["…"] }
  ],
  "existing": ["185245937"],
  "failed": [
    { "orderNumber": "182330277", "error": "…descrição…" }
  ],
  "createdProducts": [
    { "code": "60233778", "name": "dōTERRA® Kit Collector’s" }
  ]
}
```

- Per-order transaction (partial success allowed; one order failing never
  rolls back the others).
- `existing` orders are **never read-modified-written** in any way.
- `warnings` examples: computed total differs from `listValue` (order is still
  created — the detail items are authoritative); product code exists but is
  `INATIVO`/`PENDENTE_CADASTRO` in the catalog (item is linked anyway; the
  user resolves it during review or by updating the catalog CSV).

## 6. Backend implementation

### 6.1 Prisma schema + migration (additive)

- `Order.pendingReview Boolean @default(false)`.
- `enum ProductStatus` + `PENDENTE_CADASTRO`.
- Migration is a plain `ALTER TYPE … ADD VALUE` + `ALTER TABLE … ADD COLUMN`
  (safe on a database with data; review the generated SQL, never hand-edit a
  rename that is not one).
- Standing procedure after the schema change: `npx prisma generate` locally
  **and inside the container** when the Docker stack is up; apply with
  `npx prisma migrate deploy` locally
  (`DATABASE_URL=…@localhost:5432/receivables`) and
  `docker compose exec backend npx prisma migrate deploy`. Never
  `migrate dev` on a database with data.

### 6.2 Multi-scope API tokens

`backend/src/services/apiTokenService.js`:

- `API_TOKEN_SCOPES = ['uber:import', 'doterra:import']`.
- Storage keeps a comma-joined string (`scope` column, e.g.
  `"uber:import,doterra:import"`); `authorizeApiToken` validates membership
  (`record.scope.split(',').includes(scope)`) instead of exact equality —
  backward compatible with existing single-scope tokens.
- `createApiToken` accepts a scopes array (validator: array of the known
  values, non-empty, deduplicated; default `['uber:import']` so existing
  callers/tests stay valid). `publicToken` returns `scope` (joined) — the UI
  shows it.
- `backend/src/validators/apiTokenValidator.js` + the create endpoint payload
  updated accordingly (non-breaking: accept both `scope` string and `scopes`
  array, or just `scopes`).

### 6.3 New routes + middleware

- `backend/src/middlewares/apiTokenAuth.js`: add
  `authenticateDoterraImport` (scope `doterra:import`) mirroring
  `authenticateUberImport`. **Only** the two new routes use it; everything
  else stays session-JWT-only.
- New `backend/src/routes/doterraRoutes.js` mounted at `/api/doterra`:
  - `POST /orders/lookup` (composed middleware first, then
    `router.use(authenticateToken)` — copy the `uberRoutes.js` route-order
    pattern and its OpenAPI annotations).
  - `POST /orders/import`.
- Register in `app.js` next to the other routers.

### 6.4 Validator + service

`backend/src/validators/doterraValidator.js` (Zod, per-domain contract):

- `lookupSchema`: `numbers` array of non-empty strings, min 1.
- `importSchema`: `orders` array (min 1) of:
  - `orderNumber` string min 1; `orderDate` `YYYY-MM-DD`;
    `accountOwner` ≤ 120 optional; `listTypeCode`/`listOriginCode` optional
    short strings; `pvMonth` optional `YYYY-MM`;
    `doterraPv`, `listValue`, `shippingValue`, `installmentValue` numbers ≥ 0
    optional; `paymentType` nullable via the shared `paymentTypeSchema`;
    `installments` int 1–24 optional; `items` array min 1 of
    `{ code` string min 1 max ~20`, description` ≤ 500 optional`,
    quantity` int ≥ 1`, unitPrice, unitPv` ≥ 0` }`.
  - `superRefine`: when `paymentType === 'CARTAO_CREDITO'`, `installments` is
    required (mirror `requireCreditCardFields`; `firstInstallmentAt` is NOT
    required from the client — the service defaults it to `orderDate`).

`backend/src/services/doterraOrdersService.js` —
`lookupOrders(client, { userId, numbers })` and
`importOrders(client, { userId, orders })`:

- `lookupOrders`: `order.findMany({ where: { userId, orderNumber: { in } } })`
  → partition.
- `importOrders`: loop over `orders`, one `$transaction` per order:
  1. Skip when `order.findFirst({ where: { userId, orderNumber } })` exists →
     push to `existing` (never touch).
  2. Resolve every item code inside the transaction:
     - existing `Product` with `ATIVO`/`INDISPONIVEL` → link;
     - existing with `INATIVO`/`PENDENTE_CADASTRO` → link + warning (the order
       is pending review anyway);
     - missing → create the draft (§6.5) once per code and link (two item
       lines with the same code both link to the one draft).
  3. Build the order payload and create it through a **shared creation core
     extracted from `ordersService.createOrder`** (see below): items with
     `productId`, `chargedValue = unitPrice`, `chargedValueMode: 'UNIT'`,
     `memberPrice = unitPrice`, `quantity`, `description`; `personId` and
     `forStock` omitted (defaults bind the self person and set `forStock`
     true → stock ENTRADA, which is the correct semantics for a purchase);
     `orderDate` via `parseLocalDate`; `doterraPv`; `shippingValue`;
     `paymentType` (+ `installments`, `firstInstallmentAt = orderDate`);
     `accountOwner`; `orderNotes` = `"Importado via extensão dōTERRA em
     dd/mm/aaaa"` (+ append warning lines, keep ≤ 2000 chars).
  4. Create with `pendingReview: true`.
  5. Cross-check: computed `totalValue` vs `listValue` — if they differ by more
     than R$ 0.01, add a warning (order is still created).
  6. Collect per-order result (`created` with warnings / `failed` with the
     HTTP-mapped error message).
- **Refactor (SRP, follows the repo's service-extraction history):** extract
  the transactional core of `ordersService.createOrder` into an internal
  `createOrderInTx(tx, { userId, payload, pendingReview = false, … })` (or a
  shared module) so the import service can call it **inside its own
  transaction** (draft products must be created in the same transaction as the
  order; do **not** nest `client.$transaction` on a transaction client).
  `createOrder` keeps its current signature/behavior (manual orders keep
  `pendingReview: false`). The product validation inside the core must accept
  the draft ids the import just created (e.g. `allowProductIds` parameter);
  everything else — defaults, kit snapshot resolution, stock entry, ledger
  sync, status — is reused unchanged.

### 6.5 Draft products + cascade cleanup

**Draft creation** (inside the import transaction, once per unknown code):

```js
product.create({
  code,                                  // e.g. "60233778"
  name: <detail description, cleaned>,    // strip <sup>/<br>/extra spaces
  size: '',                              // completed by the user later
  status: 'PENDENTE_CADASTRO',
  productType: 'SIMPLES',                 // kit composition is unknown here
});
productPrice.create({
  productId, regularPrice: 0,            // forces review; memberPrice: unitPrice, pv: unitPv,
});
```

- `regularPrice: 0` is a deliberate "not filled" marker; the Products page edit
  completes it. Drafts never appear in order/sale forms
  (`getProducts?available=true` filters `ATIVO`/`INDISPONIVEL` only).
- `validateProducts` stays unchanged (manual writes still reject
  `PENDENTE_CADASTRO`/`INATIVO`); only the import path may reference its own
  just-created drafts. Consequence (accepted): editing an imported order
  fails with "produtos inativos" until the drafts are registered+activated —
  that is the review flow working as designed.

**Cascade cleanup on order deletion** (`deleteOrder`): today the flow already
reverses stock (`reverseOrderStock` — compensating SAIDA movements),
`removeBillForOrder`, and deletes the order (items/payments/ledger cascade;
`StockMovement.orderId` is `SetNull`, so the movements survive orphaned).
Add a cleanup helper — suggested
`backend/src/services/draftProductCleanup.js` —
`cleanupOrderDraftProducts(tx, { order })`:

1. **Before deleting**, collect `draftCandidates` = products referenced by the
   order's items with `status === 'PENDENTE_CADASTRO'`, and the order's
   movement ids (`stockMovement.findMany({ where: { orderId } }, select id)`).
2. Run the existing delete flow (reversal, bill removal, order delete).
3. For each candidate, delete it (with its `ProductPrice` cascade) **only if
   all of these hold**:
   - no remaining `Item.productId` references it (another order — e.g. a second
     import reusing the same draft code — keeps it alive);
   - no remaining `StockMovement.productId` references it besides the captured
     order movement ids (delete exactly those with the product; any other
     movement keeps the product);
   - no `KitComposition` row references it in either direction;
   - no `Inventory` row exists for any user other than this user's row, and
     this user's row has `quantity === 0` (delete that row; after the ENTRADA +
     SAIDA pair it nets to zero).
   Otherwise the draft stays (it graduated to real usage or was registered by
   the user — status would no longer be `PENDENTE_CADASTRO` anyway).
4. Products the user already registered/activated are never deleted (status
   check guarantees it).

Scope decision (documented): the cleanup runs **only in `deleteOrder`**. Item
removal during edits (`deleteItem`/`updateOrder`) keeps today's behavior — a
draft orphaned that way remains listed as "Pendente de cadastro" in the
Products page for manual handling; deleting the order's own stock history
while the order lives would corrupt it.

### 6.6 Orders service/routes changes

- `getOrders`: support `pendingReview=yes|no` query (mirror the rides
  `launched` filter); Prisma returns the new field automatically.
- `updateOrder`: on any successful save set `pendingReview: false` (saving =
  reviewed).
- New small endpoint for the quick action, following the existing
  `ordersRoutes.js` style: `PATCH /api/orders/:id/review` → sets
  `pendingReview: false`, returns the updated order (session-JWT only, like
  the other order routes). Include an OpenAPI annotation.
- `backend/docs/` OpenAPI spec (if the routes carry `@openapi` blocks, add
  matching ones): `DoterraOrderImportInput`, `DoterraOrderImportSummary`,
  `DoterraLookupInput/Output`.

## 7. Frontend (app) implementation

### 7.1 Orders page

- Header buttons: add **"Importar pedidos"** (secondary style, next to
  "Simulador") opening a new modal (shared `components/Modal.jsx`, read-only →
  no `isDirty`):
  - "Como capturar?" section: link/button to download the extension
    (`/uber-rides-extension.zip`, same as the Corridas welcome modal) + short
    PT-BR instructions (log into `office.doterra.com`, open
    `Rastreamento de Pedidos e Pacotes`, use the box);
  - token generation (shared UI, §7.3);
  - textarea to paste the captured JSON + "Importar" button (session JWT via
    the api service) + result summary (created/existing/failed +
    `createdProducts` + per-order warnings) rendered from §5.3.
  - Follow the `UberRideImportModal.jsx` structure and the progressive
    complexity policy in `frontend/docs/frontend-architecture-guide.md`
    (new components under `pages/Orders/components/`; hooks follow the
    existing flat `pages/Orders/use*.js` layout, as in `useOrders.js`).
- `Badges.jsx` + `frontend/src/utils/badgeStyles.js`: new
  **"Pendente de revisão"** badge (use the semantic token palette,
  e.g. `warning`-family; add the class map in `badgeStyles.js`, never inline).
- `OrdersTable`/`OrdersTableToolbar`/`useOrderFilters`/`useOrders`: a
  "Revisão" filter (Pendentes/Revisados/Todos) wiring the `pendingReview`
  query param; badge shown on `order.pendingReview`.
- Row quick action **"Marcar revisado"** for pending rows (calls the new
  review endpoint; toast on success; `refreshOrders` afterwards).
- Editing + saving already clears the flag server-side; the UI refreshes.

### 7.2 Products page

- `pages/Products/utils/productHelpers.js` `PRODUCT_STATUS` map + status
  filter options + badge: **`PENDENTE_CADASTRO` → "Pendente de cadastro"**
  (distinct color from `INATIVO`, `badge-*` token classes).
- Completing a draft = existing edit form (name/size/prices) + status change
  to `ATIVO` via the existing confirm flow; "Salvar e editar próximo" already
  helps batches.
- Backend `getProducts` needs no change (status filter passes through), but
  verify `updateProductSchema` (product validator) accepts the new enum
  value for status transitions.

### 7.3 Token UI generalization

- `pages/UberRides/hooks/useApiTokens.js` hardcodes `scope: 'uber:import'`.
  Generalize to selectable scopes — checkboxes `Corridas Uber
  (uber:import)` + `Pedidos dōTERRA (doterra:import)`, **both checked by
  default** — sending `scopes` (or the joined `scope`) to
  `POST /api/api-tokens`. Reuse the same hook/component in both the Corridas
  welcome modal and the new Orders import modal (extract to a shared location
  if duplication would exceed the architecture guide's thresholds — keep the
  refactor scoped).

## 8. Extension implementation (`tools/uber-rides-extension/`, v0.5.0 → v0.6.0)

### 8.1 `manifest.json`

- Add content script (ISOLATED world only — DOM scraping needs no MAIN-world
  network hook):

```json
{
  "matches": ["https://office.doterra.com/*"],
  "js": ["src/doterra/content.js"],
  "run_at": "document_start",
  "world": "ISOLATED",
  "all_frames": false
}
```

- `host_permissions`: add `"https://office.doterra.com/*"` (defensive; the
  detail fetches are same-origin from the content script).
- Version `0.6.0`, updated `name`/`description` covering both captures (e.g.
  "Capturas — Uber & dōTERRA"); update `VERSION`/`BUILD_LABEL` constants in
  **every** self-contained file (`ui/content.js`, `popup.js`,
  `background.js`, the new script) — the build label is how the user verifies
  the rebuild.
- Update `README.md` with the dōTERRA capture section.

### 8.2 `src/doterra/content.js` (new, self-contained, ISOLATED)

Structure (vanilla JS, same style as `src/ui/content.js`):

1. **Activation**: mount only when
   `/index.cfm?…Fuseaction=evo_Modules.OrderHistoryFull…` (case-insensitive on
   the `fuseaction` param). Box id e.g. `doterra-orders-capture-box`.
2. **Row parsing** of `#OrderhistoryRows tr` per §4.1 (14 cells, index-based;
   skip rows whose cancel cell contains `.OrderCancelLink`; codes/quantities
   paired by `<br>` index; `data-sort-value` for PV/value; `dd/mm/yyyy` →
   `YYYY-MM-DD` local; boleto/pix detection from the payment link cell).
3. **Auto-paginate** button "Carregar mais antigos": replicate the page's
   `VIEWMORE` (§4.2) — read `document.querySelectorAll('.startdate')` last
   value, GET the URL (same-origin, `credentials: 'same-origin'`), parse the
   fragment, append rows to `#OrderhistoryRows`, keep the returned hidden
   input, remove `#ajaxrowstable`; loop with the §4.2 guards; live progress in
   the box log.
4. **`MutationObserver`** on `#OrderhistoryRows` (childList) → debounce a
   recount (covers manual "Ver mais" clicks).
5. **Lookup** (when a token is stored): `chrome.runtime.sendMessage` →
   background `POST /api/doterra/orders/lookup` with the parsed numbers →
   display "X pedidos · Y não pagos ignorados · Z novos · W já importados".
6. **"Importar novos pedidos"** (gated on the stored token, like the Uber
   send button):
   - for each missing order: fetch its detail URL (§4.3) sequentially
     (~400 ms apart, 15 s timeout each), parse items/quantities
     (`Qtde encomendada`)/descriptions/PV/prices, totals (Frete, Total a
     Pagar, `NN Parcelas de`), payment type per §4.3; skip the totals row;
     - on fetch failure (timeout/non-200/login redirect): mark that order
       `failed` in the result and continue with the others; never build an
       order without its detail data;
   - build the §5.1 payload (merge list data + detail data) and send via
     background (`DOTERRA_SEND_TO_APP`);
   - render the §5.3 summary (created/existing/failed/createdProducts +
     warnings) in the box log;
   - on success the background opens `${server}/orders` in a new tab;
   - on send failure: copy the payload JSON to the clipboard with the hint to
     paste it in the app's "Importar pedidos" modal (the capture is never
     lost).
7. **"Capturar e copiar JSON"** button: same payload → clipboard only (manual
   paste path, mirroring the Uber dual-path rule).
8. Keep every rule self-contained in this one file: no shared `globalThis`
   namespace with the Uber scripts, no imports; storage keys are read-only
   from `chrome.storage.local` for gating only.

### 8.3 `src/background/background.js`

- Add message type `DOTERRA_SEND_TO_APP` →
  `POST ${base}/api/doterra/orders/import` with the stored token (same
  `chrome.storage.local` keys as today — **do not rename them**), map
  401/403/HTTP errors like `SEND_TO_APP` does, and on success open
  `${base}/orders` in a new tab. No new permissions needed (localhost is
  already covered; the dōTERRA fetches happen in the content script).

### 8.4 `src/popup/`

- Copy updates mentioning the two captures (same token covers both when it
  carries both scopes); optionally a link/button opening the dōTERRA order
  history page. Keep the existing Uber behavior untouched.

### 8.5 Rebuild/verification procedure (from `AGENTS.md`)

Manifest edits require **remove + re-add** in `chrome://extensions`; the
*Reload* button does not always re-read the manifest. Content-only edits need
*Reload* + Ctrl+Shift+R. Verify via the build label (`v0.6.0 · <label>`) in
the floating box, popup and console. The zip is regenerated by the frontend
`predev`/`prebuild` (`scripts/package-extension.mjs`) — in-app "Baixar
extensão (ZIP)" button keeps working unchanged.

## 9. Test plan (TDD — write tests first)

Suites: `backend/tests/*.test.js` (serial, shared DB,
`fileParallelism: false`) and `frontend/tests/*.test.jsx|.js`. Mocks: lazy
arrow wrappers in `vi.mock()` factories. Include realistic fixtures from
§5.1/§4.3.

### 9.1 Backend — new `backend/tests/doterraOrdersImport.test.js` (+ additions)

- **Lookup**: partitions existing/missing; auth 401 without token/JWT, 403
  with wrong-scope token; session JWT works.
- **Import — dedup**: order number already registered (COMPRA) → `existing`,
  order untouched (assert no field changed, no new ledger/stock rows); number
  matching a VENDA order → also `existing` (no P2002).
- **Import — creation**: order created with `orderType COMPRA`,
  `pendingReview: true`, self-person items, `forStock: true`, stock ENTRADA
  movements, `DESPESA`/`PEDIDO_DOTERRA` ledger row (amount = total,
  description `Pedido dōTERRA <n>`), `doterraPv`, `shippingValue` in the total.
- **Import — card**: `CARTAO_CREDITO` + installments creates the bill + N
  installment transactions (reuse the expectations style of
  `ordersCreditCard.test.js`); `firstInstallmentAt` defaults to the order
  date; non-card payment types (BOLETO/PIX/null) create no bill.
- **Import — products**: known `ATIVO` code links; unknown code creates the
  draft (`PENDENTE_CADASTRO`, SIMPLES, price row `regularPrice 0` /
  `memberPrice unitPrice` / `pv unitPv`) and links it; the same unknown code in
  two lines/orders creates one draft; `INATIVO` existing code links + warning.
- **Import — totals cross-check**: items sum ≠ `listValue` → warning, order
  still created; promo zero-price items (`5025`, `60205740`) import at 0.
- **Import — partial failure**: second order invalid (e.g. empty items) →
  first still committed, `failed` carries the message.
- **Import — idempotency**: posting the same payload twice → second run all
  `existing`, zero new rows.
- **Tokens**: multi-scope token accepted by both import routes; single-scope
  old token still works for uber and is 403 for doterra; create endpoint
  accepts scopes array (extend `apiToken.test.js`).
- **Review endpoint + filters**: `PATCH /api/orders/:id/review` clears the
  flag; `updateOrder` clears it on save; `GET /api/orders?pendingReview=yes`
  filters (extend `orders.test.js`).
- **Cascade cleanup** (`deleteOrder` with imported orders):
  - deleting an imported order removes the order + items + payments + ledger
    rows + bill, restores inventory to the pre-import quantity, deletes the
    draft products created for it (with their `ProductPrice`, `Inventory` row
    and the ENTRADA/SAIDA movements the order produced);
  - draft referenced by a second imported order survives the first order's
    deletion (and is removed by the second's);
  - draft the user activated (`ATIVO`) survives;
  - draft with a kit-component reference or foreign-user inventory row
    survives;
  - a regular (non-draft) product keeps today's compensating-movement
    behavior — only drafts are hard-removed.

### 9.2 Frontend — new/extended `frontend/tests/` files

- Orders import modal: renders, pastes JSON, submits, renders the summary
  (created/existing/failed/createdProducts/warnings), token section with both
  scopes checked by default.
- Orders table: "Pendente de revisão" badge for `pendingReview: true`; filter
  interplay with existing filters; "Marcar revisado" action calls the endpoint
  and refreshes.
- Products: `PENDENTE_CADASTRO` label/badge/filter option; activation via the
  existing status-change confirm.
- Token UI: sends the selected scopes (default both).
- Keep the z-index and Modal/`isDirty` conventions; PT-BR strings; tokenized
  palette classes only (run `node scripts/contrast-check.mjs` if any token
  value changes — new badge classes must reuse existing tokens).

## 10. Verification checklist (before declaring done)

1. `cd backend && npm run test` and `cd frontend && npm run test` (full suites).
2. `npm run lint` (root) and `npm run format:check`.
3. `cd frontend && npm run build`.
4. **Live-test the new endpoints** (standing rule `_rules/new-endpoint-live-test.md`):
   start the stack (`docker compose up --build`), apply the migration in the
   container (`docker compose exec backend npx prisma migrate deploy` +
   `npx prisma generate`), then exercise with curl + jq:
   `POST /api/doterra/orders/lookup` and `POST /api/doterra/orders/import`
   (happy path with the §5.1 fixture, 401 without auth, 403 wrong scope,
   idempotent re-import, `PATCH /api/orders/:id/review`, order deletion
   cascade), and the token creation with both scopes.
5. Extension: rebuild (`npm run dev`/`build` in frontend regenerates the
   zip), remove + re-add in `chrome://extensions`, log into
   `office.doterra.com`, open `Rastreamento de Pedidos e Pacotes`, confirm the
   box shows the parsed counts, run "Carregar mais antigos", capture and
   import, verify the build label `v0.6.0 · <label>`, confirm the app opens
   on `/orders` with the pending-review orders, register a draft product and
   re-save the imported order, then delete a pending imported order and
   confirm the cascade cleanup in Adminer (product, prices, inventory,
   movements, ledger, bill).
6. Update `ARCHITECTURE.md` (new endpoints, statuses, extension dual capture)
   and `AGENTS.md` (pitfalls: the doterra content script world, multi-scope
   tokens, the draft cascade rule) — only for what changes in their scope.
7. Follow the `AGENTS.md` **New Feature Workflow** step 4: ask the user
   > "Você tem mais algum ajuste a adicionar nesta versão?" — `NOTES.md`
   entry per adjustment; on "no", consolidate everything into a new dated
   `## Phase N` section in `CHANGELOG.md` and clear `NOTES.md`. `NOTES.md` is
   **never committed**.

## 11. Suggested implementation order + commits (Conventional Commits)

1. `test(backend): doterra orders import and lookup coverage` — failing tests
   for §9.1.
2. `feat(backend): doterra orders import with pending review and draft products`
   — schema+migration, tokens multi-scope, validator, middleware, routes,
   service, cascade cleanup, orders changes.
3. `test(frontend): doterra import modal and review badges coverage` — §9.2.
4. `feat(frontend): doterra orders import ui with review workflow` — modal,
   badges/filters, review action, products status, token scopes.
5. `feat(backend)`: (if the review endpoint landed separately, keep it inside
   commit 2 instead — prefer 2 backend commits: tests + behavior).
6. `config(extension): doterra orders capture` / `feat(extension): doterra
   orders capture` — manifest + `src/doterra/content.js` + background/popup +
   README (one commit).
7. `docs:` — after the user's final confirmation (commit `CHANGELOG.md` +
   `ARCHITECTURE.md`/`AGENTS.md` updates together per the workflow).

Commits are made **only when the user explicitly asks** (standing rule);
group per phase as above.

## 12. Key pitfalls (from `AGENTS.md`, restated for this work)

- Integer cents for all monetary arithmetic (`toCents`/`fromCents`/
  `formatBRL`); payload numbers are converted server-side.
- `YYYY-MM-DD` parsed as local dates (`parseLocalDate`); never
  `new Date('YYYY-MM-DD')` for display.
- After the schema change: `npx prisma generate` locally **and in the
  container**; `migrate deploy` (never `migrate dev`) on databases with data.
- Backend Vitest `fileParallelism: false`; `vi.mock` hoisting — lazy arrow
  wrappers.
- Modal z-index hierarchy; shared `components/Modal.jsx` for every dialog.
- Tokenized Tailwind palette only; badge/status class maps live in
  `frontend/src/utils/badgeStyles.js`.
- Extension files stay self-contained; never share a `globalThis` namespace
  across worlds; never declare one file path in two `content_scripts` worlds.
- Only the two new dōTERRA routes get the composed token middleware; never
  widen it.
- Prisma transaction reads are stale after a create — include new rows
  explicitly when recomputing (relevant in the import/cascade transactions).
- `Order` unique is `(orderNumber, userId)` with **no orderType** — the
  dedup/lookup must consider orders of any type.
