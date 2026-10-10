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
    include: {
      person: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          instagram: true,
          isSelf: true,
          isVip: true,
          isDoterraMember: true,
          isTeamMember: true,
        },
      },
      lines: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitValueCents: true,
          direction: true,
        },
      },
    },
  });

  return {
    exchange: {
      ...finalExchange,
      outgoingLines: finalExchange.lines.filter((l) => l.direction === 'OUT'),
      incomingLines: finalExchange.lines.filter((l) => l.direction === 'IN'),
    },
    outgoingMovements,
    incomingMovements,
  };
};

const getStockExchange = async (client, { id, userId }) => {
  const exchange = await client.stockExchange.findFirst({
    where: { id, userId },
    include: {
      person: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
          instagram: true,
          isSelf: true,
          isVip: true,
          isDoterraMember: true,
          isTeamMember: true,
        },
      },
      lines: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          productId: true,
          quantity: true,
          unitValueCents: true,
          direction: true,
        },
      },
    },
  });
  if (!exchange) {
    throw notFound('Troca não encontrada');
  }
  return {
    ...exchange,
    outgoingLines: exchange.lines.filter((l) => l.direction === 'OUT'),
    incomingLines: exchange.lines.filter((l) => l.direction === 'IN'),
  };
};

export { createStockExchange, getStockExchange };
