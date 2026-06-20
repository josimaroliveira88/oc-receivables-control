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

- negative payments
- overpayments
- partial inconsistent writes