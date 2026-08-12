---
name: prisma-financial
description: Financial and database consistency rules.
---

# Prisma Standards

## Monetary Values

Always use:

@db.Decimal(10,2)

Never use:

- Float
- Number

## Important: Prisma Decimal Return Type

Prisma returns Decimal(10,2) fields as strings, not numbers.
Always use parseFloat() when comparing or performing arithmetic:
```js
const value = parseFloat(record.decimalField); // "100.50" → 100.5
```

## Transactions

Financial operations must use:

prisma.$transaction()

when multiple records are modified.

## Referential Integrity

Order:
- onDelete Cascade

Payment:
- onDelete Cascade

Item:
- onDelete Cascade

Person:
- onDelete SetNull

## Financial Integrity

Never allow:

- negative payments (rejected by Zod `nonnegative()`)
- zero payments against a person with chargeable items (`itemSumCents > 0 && amountCents === 0` rejected with `'Amount must be greater than zero for a person with chargeable items'`)
- partial inconsistent writes

Allowed (with frontend confirmation gate — custom `ConfirmDialog` on the Recebíveis screen):

- zero-value payments (R$ 0,00 "Dar baixa" for gift items with `chargedValue = 0`, i.e. `itemSum === 0`)
- overpayments (amount > pending balance; pending clamps at 0, the excess stays recorded in `paymentTotal`)