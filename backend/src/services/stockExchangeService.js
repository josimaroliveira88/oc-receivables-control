// Stock-exchange business rules: validate the person, the products, persist
// the header + lines and emit one StockMovement per line in a single
// transaction. Reuses the existing stock primitive (`applyMovement`) so the
// "no negative stock" rule stays in one place.
//
// `client` is either the Prisma client or a transaction client (`tx`).
import { notFound, badRequest } from '../utils/httpError.js';
import { applyMovement } from './stockService.js';

const buildReason = ({ exchangeId, personName, observation }) => {
  const base = `Troca #${exchangeId} com ${personName}`;
  if (!observation) return base;
  const trimmed = observation.trim();
  if (!trimmed) return base;
  return `${base}: ${trimmed}`;
};

// Shared query selections so the create, read and list responses always expose
// the same shape (including the product the line refers to).
const PERSON_SELECT = {
  id: true,
  name: true,
  whatsapp: true,
  instagram: true,
  isSelf: true,
  isVip: true,
  isDoterraMember: true,
  isTeamMember: true,
};

const LINE_SELECT = {
  id: true,
  productId: true,
  quantity: true,
  unitValueCents: true,
  direction: true,
  product: { select: { id: true, code: true, name: true, size: true } },
};

const EXCHANGE_INCLUDE = {
  person: { select: PERSON_SELECT },
  lines: { orderBy: { createdAt: 'asc' }, select: LINE_SELECT },
};

// Partitions the persisted lines into the two sides the API exposes. Shared by
// every read path.
const formatExchange = (exchange) => ({
  ...exchange,
  outgoingLines: exchange.lines.filter((l) => l.direction === 'OUT'),
  incomingLines: exchange.lines.filter((l) => l.direction === 'IN'),
});

// Stock movements carry no exchange link; they are identified by the reason
// prefix built in `buildReason` (the same convention used by
// `productUsageService`). The full exchange id plus the trailing space keeps
// one exchange from ever matching another.
const exchangeReasonPrefix = (exchangeId) => `Troca #${exchangeId} `;

const createStockExchange = async (
  client,
  {
    userId,
    personId,
    effectiveDate,
    observation,
    outgoingLines,
    incomingLines,
  },
) => {
  const person = await client.person.findFirst({
    where: { id: personId, userId },
    select: { id: true, name: true },
  });
  if (!person) {
    throw notFound('Pessoa não encontrada');
  }

  const allLineProductIds = [
    ...new Set([
      ...outgoingLines.map((l) => l.productId),
      ...incomingLines.map((l) => l.productId),
    ]),
  ];

  const products = await client.product.findMany({
    where: { id: { in: allLineProductIds } },
    select: { id: true, status: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  for (const line of [...outgoingLines, ...incomingLines]) {
    const product = productById.get(line.productId);
    if (!product) {
      throw notFound(`Produto não encontrado: ${line.productId}`);
    }
    if (product.status === 'PENDENTE_CADASTRO') {
      throw badRequest(
        'Produtos pendentes de cadastro não podem ser usados em trocas',
      );
    }
  }

  // Create the header without reason/observation first so we have its id to
  // build the structured StockMovement.reason string. `effectiveDate` is
  // parsed as a local date (matches the rest of the codebase).
  const [year, month, day] = effectiveDate.split('-').map(Number);
  const parsedEffectiveDate = new Date(year, month - 1, day);

  const exchange = await client.stockExchange.create({
    data: {
      userId,
      personId: person.id,
      effectiveDate: parsedEffectiveDate,
      observation: observation ?? null,
    },
  });

  const reason = buildReason({
    exchangeId: exchange.id,
    personName: person.name,
    observation,
  });

  const outgoingMovements = [];
  for (const line of outgoingLines) {
    const result = await applyMovement(client, {
      userId,
      productId: line.productId,
      type: 'SAIDA',
      quantity: line.quantity,
      reason,
      effectiveDate: parsedEffectiveDate,
    });
    outgoingMovements.push(result.movement);
  }

  const incomingMovements = [];
  for (const line of incomingLines) {
    const result = await applyMovement(client, {
      userId,
      productId: line.productId,
      type: 'ENTRADA',
      quantity: line.quantity,
      reason,
      effectiveDate: parsedEffectiveDate,
    });
    incomingMovements.push(result.movement);
  }

  const outgoingRows = outgoingLines.map((line) => ({
    exchangeId: exchange.id,
    productId: line.productId,
    quantity: line.quantity,
    unitValueCents: line.unitValueCents ?? null,
    direction: 'OUT',
  }));
  const incomingRows = incomingLines.map((line) => ({
    exchangeId: exchange.id,
    productId: line.productId,
    quantity: line.quantity,
    unitValueCents: line.unitValueCents ?? null,
    direction: 'IN',
  }));

  await client.stockExchangeLine.createMany({
    data: [...outgoingRows, ...incomingRows],
  });

  const finalExchange = await client.stockExchange.findUnique({
    where: { id: exchange.id },
    include: EXCHANGE_INCLUDE,
  });

  return {
    exchange: formatExchange(finalExchange),
    outgoingMovements,
    incomingMovements,
  };
};

const getStockExchange = async (client, { id, userId }) => {
  const exchange = await client.stockExchange.findFirst({
    where: { id, userId },
    include: EXCHANGE_INCLUDE,
  });
  if (!exchange) {
    throw notFound('Troca não encontrada');
  }
  return formatExchange(exchange);
};

const listStockExchanges = async (client, { userId }) => {
  const exchanges = await client.stockExchange.findMany({
    where: { userId },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    include: EXCHANGE_INCLUDE,
  });
  return exchanges.map(formatExchange);
};

// Deletes an exchange and reverses the stock it moved. The movements it
// generated are matched by the `Troca #<id>` reason prefix and removed; each
// affected product's inventory is then recomputed from what survives. Nothing
// is written before every affected product is validated, so a delete that would
// leave negative stock rolls back with a clear message.
const deleteStockExchange = async (client, { id, userId }) => {
  const exchange = await client.stockExchange.findFirst({
    where: { id, userId },
    include: {
      lines: {
        select: {
          productId: true,
          product: { select: { name: true, code: true } },
        },
      },
    },
  });
  if (!exchange) {
    throw notFound('Troca não encontrada');
  }

  const reasonPrefix = exchangeReasonPrefix(id);

  const movements = await client.stockMovement.findMany({
    where: { userId, reason: { startsWith: reasonPrefix } },
    select: { productId: true, quantity: true },
  });

  // Net signed delta the exchange applied to each product's inventory.
  const deltaByProduct = new Map();
  for (const movement of movements) {
    const current = deltaByProduct.get(movement.productId) ?? 0;
    deltaByProduct.set(movement.productId, current + movement.quantity);
  }

  const inventories = new Map();
  for (const [productId, delta] of deltaByProduct) {
    const inventory = await client.inventory.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    const newQuantity = (inventory?.quantity ?? 0) - delta;
    if (newQuantity < 0) {
      const line = exchange.lines.find((l) => l.productId === productId);
      const label = line?.product?.name || line?.product?.code || productId;
      throw badRequest(
        `Não é possível excluir a troca: o estoque de ${label} ficaria negativo`,
      );
    }
    inventories.set(productId, inventory);
  }

  await client.stockMovement.deleteMany({
    where: { userId, reason: { startsWith: reasonPrefix } },
  });
  await client.stockExchangeLine.deleteMany({ where: { exchangeId: id } });
  await client.stockExchange.delete({ where: { id } });

  // Apply the reversal only after the rows are gone. When no movement is left
  // for a product, drop the inventory row (mirrors the undo path).
  for (const [productId, inventory] of inventories) {
    if (!inventory) continue;
    const remaining = await client.stockMovement.count({
      where: { userId, productId },
    });
    if (remaining === 0) {
      await client.inventory.delete({
        where: { userId_productId: { userId, productId } },
      });
    } else {
      await client.inventory.update({
        where: { userId_productId: { userId, productId } },
        data: { quantity: inventory.quantity - deltaByProduct.get(productId) },
      });
    }
  }
};

export {
  createStockExchange,
  getStockExchange,
  listStockExchanges,
  deleteStockExchange,
};
