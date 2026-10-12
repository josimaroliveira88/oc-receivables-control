// dōTERRA orders import: turns the capture JSON produced by the Chrome
// extension into purchase orders flagged for review. Every read/write is
// scoped by `userId`; the import is idempotent by order number and allows
// partial success (one order failing never rolls back the others).
import { formatBRL, toCents } from '../utils/money.js';
import { translateZodIssues } from '../utils/zodMessages.js';
import {
  importOrderSchema,
  fillAccountOwnerEntrySchema,
} from '../validators/doterraValidator.js';
import { createOrderInTx } from './ordersService.js';

// A captured order the user already has still has an empty `accountOwner` when
// it was imported before the capture learned to name the person. The field is
// purely descriptive (no ledger, total, status or stock reads it), so an empty
// one is exactly what the account owner fill is meant to repair.
const isBlankAccountOwner = (value) => !String(value ?? '').trim();

// Which captured numbers already belong to the user. "Existing" means any
// order (regardless of `orderType`), because the database unique is
// `(orderNumber, userId)` — a collision with a manually-typed number can never
// become a P2002 on import. `existingWithoutAccountOwner` narrows the existing
// ones down to the orders the fill can still improve.
const lookupOrders = async (client, { userId, numbers }) => {
  const unique = [...new Set(numbers)];

  const rows = await client.order.findMany({
    where: { userId, orderNumber: { in: unique } },
    select: { orderNumber: true, accountOwner: true },
  });
  const existingSet = new Set(rows.map((row) => row.orderNumber));

  return {
    existing: unique.filter((number) => existingSet.has(number)),
    missing: unique.filter((number) => !existingSet.has(number)),
    existingWithoutAccountOwner: unique.filter((number) => {
      const row = rows.find((candidate) => candidate.orderNumber === number);
      return row ? isBlankAccountOwner(row.accountOwner) : false;
    }),
  };
};

// The detail description can carry HTML markers (<sup>®</sup>, <br/>). The
// extension cleans it, but the draft name is normalized here as well so the
// catalog never stores markup.
const cleanProductName = (value, fallback) => {
  const cleaned = String(value ?? '')
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || fallback || '').slice(0, 200);
};

// `YYYY-MM-DD` -> `dd/mm/aaaa` for the human notes. No `new Date()` parsing to
// avoid timezone shifts.
const formatDateBR = (isoDate) => {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

// Notes carry the import marker plus every warning, bounded to the column
// limit. Warnings are the user's cue during review.
const buildOrderNotes = (order, warnings) => {
  const lines = [
    `Importado via extensão dōTERRA em ${formatDateBR(order.orderDate)}`,
  ];
  for (const warning of warnings) lines.push(warning);
  return lines.join('\n').slice(0, 2000);
};

// Creates the order inside the provided transaction, resolving every item code
// to a catalog product and auto-registering the missing ones as drafts.
const createImportedOrder = async (tx, { userId, order }) => {
  // Step 1: an order number the user already has (of any type) is never
  // touched or written.
  const already = await tx.order.findFirst({
    where: { userId, orderNumber: order.orderNumber },
    select: { id: true },
  });
  if (already) {
    return { existing: true };
  }

  const warnings = [];
  const allowedProductIds = [];
  const newProducts = [];
  const productByCode = new Map();
  const resolvedItems = [];
  const warnedKitCodes = new Set();

  for (const item of order.items) {
    let info = productByCode.get(item.code);

    if (!info) {
      const existing = await tx.product.findUnique({
        where: { code: item.code },
      });

      if (existing) {
        info = { productId: existing.id, productType: existing.productType };
        if (
          existing.status === 'INATIVO' ||
          existing.status === 'PENDENTE_CADASTRO'
        ) {
          const label =
            existing.status === 'INATIVO' ? 'inativo' : 'pendente de cadastro';
          warnings.push(
            `Produto ${item.code} está ${label} no catálogo; revise o item.`,
          );
          // The order is pending review, so an unavailable catalog product can
          // still be linked (the user resolves it during review).
          allowedProductIds.push(info.productId);
        }
      } else {
        const name = cleanProductName(item.description, `Produto ${item.code}`);
        const draft = await tx.product.create({
          data: {
            code: item.code,
            name,
            size: '',
            status: 'PENDENTE_CADASTRO',
            productType: 'SIMPLES',
          },
        });
        await tx.productPrice.create({
          data: {
            productId: draft.id,
            regularPrice: 0,
            memberPrice: item.unitPrice ?? 0,
            pv: item.unitPv ?? 0,
          },
        });
        info = { productId: draft.id, productType: draft.productType };
        allowedProductIds.push(draft.id);
        newProducts.push({ code: item.code, name });
      }

      productByCode.set(item.code, info);
    }

    // A catalog KIT item cannot be stocked without a mode. The import defaults
    // to KIT (always yields a valid movement for the kit itself) and warns so
    // the user can switch to COMPONENTS during review; the frozen snapshot is
    // kept either way, so changing the mode adjusts stock through the diff.
    const isKit = info.productType === 'KIT';
    if (isKit && !warnedKitCodes.has(item.code)) {
      warnedKitCodes.add(item.code);
      warnings.push(
        `Produto KIT ${item.code} importado no modo de estoque KIT; troque para COMPONENTS na revisão se o kit for controlado por componentes.`,
      );
    }

    resolvedItems.push({
      productId: info.productId,
      description: item.description ?? null,
      chargedValue: item.unitPrice ?? 0,
      memberPrice: item.unitPrice ?? 0,
      quantity: item.quantity,
      chargedValueMode: 'UNIT',
      kitStockMode: isKit ? 'KIT' : null,
    });
  }

  const payload = {
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    shippingValue: order.shippingValue ?? 0,
    paymentType: order.paymentType ?? null,
    installments: order.installments ?? null,
    firstInstallmentAt:
      order.paymentType === 'CARTAO_CREDITO' ? order.orderDate : null,
    accountOwner: order.accountOwner ?? null,
    orderNotes: buildOrderNotes(order, warnings),
    doterraPv: order.doterraPv ?? null,
    items: resolvedItems,
  };

  const createdOrder = await createOrderInTx(tx, {
    userId,
    payload,
    pendingReview: true,
    allowProductIds: allowedProductIds,
  });

  // Post-creation cross-checks. The detail items are authoritative, but a zero
  // total (a reposição) and a mismatch against the list total are both flagged
  // so the user can double-check during review.
  const computedTotalCents = toCents(createdOrder.totalValue);
  let notesChanged = false;
  if (computedTotalCents === 0) {
    warnings.push(
      'Pedido sem valor (R$ 0,00) — provavelmente reposição; confira os itens.',
    );
    notesChanged = true;
  }
  if (
    order.listValue != null &&
    Math.abs(computedTotalCents - toCents(order.listValue)) > 1
  ) {
    warnings.push(
      `Total calculado (${formatBRL(computedTotalCents)}) difere do valor informado (${formatBRL(toCents(order.listValue))}); confira os itens.`,
    );
    notesChanged = true;
  }
  if (notesChanged) {
    await tx.order.update({
      where: { id: createdOrder.id },
      data: { orderNotes: buildOrderNotes(order, warnings) },
    });
  }

  return { order: createdOrder, warnings, newProducts };
};

const importOrders = async (client, { userId, orders }) => {
  const created = [];
  const existing = [];
  const failed = [];
  const createdProducts = new Map();

  for (const rawOrder of orders) {
    const parsed = importOrderSchema.safeParse(rawOrder);
    if (!parsed.success) {
      const messages = translateZodIssues(parsed.error.errors)
        .map((issue) => issue.message)
        .join('; ');
      failed.push({
        orderNumber: rawOrder?.orderNumber ?? '',
        error: messages,
      });
      continue;
    }

    const order = parsed.data;

    try {
      const result = await client.$transaction(async (tx) =>
        createImportedOrder(tx, { userId, order }),
      );

      if (result.existing) {
        existing.push(order.orderNumber);
        continue;
      }

      for (const product of result.newProducts) {
        if (!createdProducts.has(product.code)) {
          createdProducts.set(product.code, product.name);
        }
      }

      created.push({
        orderNumber: order.orderNumber,
        id: result.order.id,
        warnings: result.warnings,
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        existing.push(order.orderNumber);
        continue;
      }
      failed.push({
        orderNumber: order.orderNumber,
        error: error?.message || 'Erro ao importar o pedido',
      });
    }
  }

  return {
    created,
    existing,
    failed,
    createdProducts: [...createdProducts].map(([code, name]) => ({
      code,
      name,
    })),
  };
};

// Fills the "Conta ID" of orders that were imported while the capture could not
// name the person. It is a correction, never a re-import: an order that does
// not exist is reported instead of created, and an order that already carries a
// value is left untouched. Only `accountOwner` is written — the field feeds no
// total, status, stock or ledger computation, so nothing has to be resynced.
const fillAccountOwner = async (client, { userId, updates }) => {
  const updated = [];
  const unchanged = [];
  const notFound = [];
  const failed = [];

  for (const raw of updates) {
    const parsed = fillAccountOwnerEntrySchema.safeParse(raw);
    if (!parsed.success) {
      failed.push({
        orderNumber: raw?.orderNumber ?? '',
        error: translateZodIssues(parsed.error.errors)
          .map((issue) => issue.message)
          .join('; '),
      });
      continue;
    }

    const { orderNumber, accountOwner } = parsed.data;

    try {
      const order = await client.order.findFirst({
        where: { userId, orderNumber },
        select: { id: true, accountOwner: true },
      });
      if (!order) {
        notFound.push(orderNumber);
        continue;
      }

      if (!isBlankAccountOwner(order.accountOwner)) {
        unchanged.push(orderNumber);
        continue;
      }

      // The previous value travels in the `where` so a value written between
      // the read and this statement (the user editing the order by hand) wins
      // over the capture instead of being silently overwritten.
      const result = await client.order.updateMany({
        where: { id: order.id, accountOwner: order.accountOwner },
        data: { accountOwner },
      });

      if (result.count === 0) {
        unchanged.push(orderNumber);
        continue;
      }

      updated.push({ orderNumber, accountOwner });
    } catch (error) {
      failed.push({
        orderNumber,
        error: error?.message || 'Erro ao preencher a Conta ID do pedido',
      });
    }
  }

  return { updated, unchanged, notFound, failed };
};

export {
  lookupOrders,
  importOrders,
  fillAccountOwner,
  cleanProductName,
  buildOrderNotes,
};
