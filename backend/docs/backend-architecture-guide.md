# Backend Architecture Guide

This is the single reference for how the Node/Express backend is organized and how any change — new feature, improvement, or maintenance — should keep it organized. It mirrors `frontend/docs/frontend-architecture-guide.md` for the API side of the system.

## 1. Principles

- **One responsibility per file.** A file owns one concern; cohesion over size.
- **Side effects isolated in layers.** HTTP concerns (parsing, responses, error mapping) live only in `controllers/`; Prisma data access lives in `controllers/` and `services/`; validation schemas live in `validators/`; pure helpers live in `utils/`.
- **Pure where possible.** If a function uses no Prisma client and no Zod schema, it belongs in `utils/`, not in a controller or validator.
- **Testability.** Business rules and pure helpers must be unit-testable without booting Express or hitting the database.

## 2. Progressive complexity policy

Not every controller needs a folder. Apply the smallest structure that keeps the file cohesive.

### Level 1 — Single file

Use for: small controllers, focused validators, single-concept helpers.

A file may stay single when it:
- does not mix many handlers, inline Zod schemas, and dense Prisma query logic;
- has no shared logic worth extracting;
- is easy to read, test, and locate logic in.

Examples: `authController.js`, small one-off helpers in `utils/`.

### Level 2 — Point extraction

Apply when a few signals of complexity appear (reusable Zod schema, relevant projection/sort helper, repeated validation, hard to test).

Extract only what is needed — no full folder required:

```text
peopleController.js
validators/peopleValidator.js
utils/classification.js
```

### Level 3 — Domain orchestrator

Apply to a controller that mixes inline Zod schemas, domain validation, heavy Prisma mutations, sorting, and projection, or that crosses ~600 lines (whichever comes first). `ordersController.js` (1403 lines) qualified because it mixed validation, kit resolution, stock integration, sorting, and eight handlers in one file — line count is a trigger, not the only signal.

```text
controllers/{nome}Controller.js      # Thin handlers: parse → validate → service → respond
services/
└── {nome}Service.js                 # Prisma domain logic (create/update/delete/etc.)
validators/
└── {nome}Validator.js               # Pure Zod schemas
utils/
├── {nome}Helpers.js                 # Pure helpers (mappers, computations)
└── {nome}Sort.js                    # Sortable fields + in-memory sort (if any)
```

Routes stay as thin single-level files (`routes/{nome}Routes.js`) that only mount `authenticateToken` and handlers — they never contain business logic.

The ~600-line threshold is a mandatory review trigger, not an absolute rule: files below it can be Level 3 if they mix responsibilities; files above it cannot stay at Level 1.

## 3. Conventions by file type

| Type | Rule |
|---|---|
| Route (`routes/{nome}Routes.js`) | Thin; calls `authenticateToken` and maps each URL to a single controller handler. No business logic. |
| Controller (`controllers/{nome}Controller.js`) | Owns the HTTP boundary: parse (`schema.parse`), call the service, map the response, and translate thrown errors (`error.status`) into HTTP responses. Handlers may use `prisma` directly for simple read-only endpoints. Should be Level 3 orchestrator when complex. |
| Service (`services/{nome}Service.js`) | Owns Prisma domain logic (transactions, sync-by-id, kit resolution, stock integration). Functions that run inside a transaction receive `client` (either the Prisma client or a `tx`) as their first argument so they are reusable in `$transaction` — this is the `applyMovement` pattern. |
| Validator (`validators/{nome}Validator.js`) | Pure Zod schemas. No Prisma runtime access, no `find` calls. Validations that need the database (e.g. "products must exist and be active") live in the service, not the validator. |
| Utils (`utils/{nome}Helpers.js`) | Pure functions for one domain: money, dates, projections, sorting, snapshot expansion. No Prisma client, no Zod. Split by domain when unrelated concepts accumulate. |
| Middleware (`middlewares/`) | Cross-cutting HTTP concerns (`auth`, `upload`). Focused on one concern. |
| Config (`config/`) | `database.js` is the single Prisma client instance; `config.js` reads env values. |

Shared infrastructure notes:

- **Prisma client:** instantiate once via `config/database.js` and reuse it. Do not create `new PrismaClient()` in every controller.
- **HTTP errors:** use the shared `utils/httpError.js` helpers (`badRequest`, `notFound`, `forbidden`, …) instead of the inline `const e = new Error(...); e.status = 400; throw e` pattern.
- **Money:** all monetary arithmetic uses integer cents via `utils/money.js` (`toCents`, `fromCents`, `lineValueCents`, `pricePerPv`). Never sum BRL with raw floats.
- **Receivables/status:** `utils/receivables.js` is the single home for `computeOrderStatus`, `personPendingCents`, person-balance computation, and status syncing. Order-balance and payment flows must not re-implement these loops.

## 4. Rules for any request

Apply to every new feature, improvement, or maintenance task:

1. **Assess before editing.** Check the complexity level of every affected file.
2. **Don't push a file past its limit.** Don't add a new responsibility to a file already at its threshold.
3. **Extract in the same change.** If your edit would make a file complex, extract the responsibility in the same request — don't defer it.
4. **Preserve an adequate structure.** If the existing structure is correct, follow it; don't refactor mechanically.
5. **Don't over-split simple files.** Forcing a folder onto a trivial file adds friction, not clarity.
6. **Verify after structural changes.** Run `npm run test`, and `npm run format:check`.

## 5. Controller refactoring playbook

When a controller is promoted to Level 3, apply these steps in order.

### Step 1 — Isolate pure functions

- Create `utils/{nome}Helpers.js` (and `utils/{nome}Sort.js` when sorting is involved).
- Move there: parsers, formatters, projections, sort fields/comparators, status maps, and calculations that use no Prisma client and no Zod schema.
- Rule: if a function uses no `client.*` and no Zod, it can be pure.

### Step 2 — Isolate Zod schemas

- Create `validators/{nome}Validator.js`.
- Move every inline `z.object(...)` there, unchanged (messages and shape preserved so Zod validation responses stay identical).
- Validations that must `find` in the database stay in the service, not the validator.

### Step 3 — Isolate domain logic

- Create `services/{nome}Service.js`.
- Move handlers' transaction bodies there: `createX`, `updateX` (sync-by-id), `deleteX`, kit resolution, stock integration, and any other Prisma-heavy flow.
- Functions that run inside `$transaction` accept `client` as their first argument.
- Services throw `httpError` helpers or errors with a `.status`, which the controller translates.

### Step 4 — Isolate sorting/search utilities

- Keep shared text search in `utils/search.js` (already canonical).
- Move controller-local sortable-field lists and in-memory comparators to `utils/{nome}Sort.js`.

### Step 5 — Rewrite the controller as orchestrator

The controller has only: schema import, service calls, `try`/error mapping, and the response. Size goal: 100–300 lines depending on the number of handlers.

### Step 6 — Keep public exports compatible

Controllers keep exporting the same handler names (`getOrders`, `createOrder`, …) so `routes/*` and existing tests need no edits.

### Step 7 — Post-refactoring checks

- [ ] `npm run test` (backend) — existing tests pass unchanged.
- [ ] `npm run format:check` (root) — Prettier ok.
- [ ] No HTTP response payload, status code, or JSON key order changed.
- [ ] Zod validation messages and ordering preserved (tests may match strings).
- [ ] Shared public helpers (`utils/receivables.js`, `utils/kitStock.js`, `utils/stockDiff.js`, `utils/money.js`, `utils/search.js`) unchanged.
- [ ] The `PrismaClient` singleton (`config/database.js`) is reused, not re-instantiated.

## 6. Anti-patterns

| Anti-pattern | Why avoid |
|---|---|
| Inline Zod schema duplicated across controllers | Extract to `validators/`; keeps messages consistent and testable. |
| Inline `badRequest`/`notFound` helpers in each file | Use shared `utils/httpError.js`. |
| `new PrismaClient()` in every controller | Reuse `config/database.js`; avoids connection leaks. |
| Stock movement logic hardcoded in `ordersController` | Call `services/stockService.js` (`applyMovement`). |
| `getOrderBalance` person-balance loops re-implemented across controllers | Centralize in `utils/receivables.js`. |
| `EQUIPE`/`PENDENTE`/`PARCIAL`/`QUITADO` strings scattered | Centralize in `utils/receivables.js`. |
| Validator doing DB `find` calls | Keep validators pure Zod; move DB-dependent validation to the service. |
| Controllers calling `res` deep inside a service | Services return values/throw; the controller maps them to responses. |

## 7. Final example

Target structure for the orders domain:

```text
backend/src/
├── controllers/
│   └── ordersController.js          # Thin handlers (~200-300 lines)
├── services/
│   ├── stockService.js              # applyMovement (canonical, client-aware)
│   └── ordersService.js             # createOrder, updateOrder (sync-by-id),
│                                    # deleteOrder, addItem, updateItem,
│                                    # deleteItem, getOrders, getOrderById
├── validators/
│   └── ordersValidator.js           # itemSchema, orderDescriptiveSchema,
│                                    # createOrderSchema, updateOrderSchema
├── utils/
│   ├── ordersHelpers.js             # itemCreateData, statusItemFromItem,
│   │                                # orderLineTotalCents, selfPersonIdSet
│   ├── ordersSort.js                # ORDER_SORTABLE_FIELDS, orderSortValue,
│   │                                # sortOrdersInMemory
│   ├── receivables.js               # computeOrderStatus, personBalances, ...
│   └── kitStock.js                  # resolveKitSnapshot, expandItemToStockProducts
├── routes/
│   └── ordersRoutes.js              # unchanged: mounts handlers
└── config/
    └── database.js                  # single PrismaClient instance
```
