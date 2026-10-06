// Uber ride persistence and ledger integration. Rides parsed from the pasted
// activity JSON are upserted by `(userId, source, externalId)` so re-importing
// the same JSON is idempotent, and each ride can generate at most one expense
// (enforced by the unique `FinancialTransaction.rideId`). All reads/writes are
// scoped by `userId`.
import { randomUUID } from 'node:crypto';
import { fromCents, toCents } from '../utils/money.js';
import { parseLocalDate } from '../utils/date.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { assertCategoryMatches } from '../utils/financeCategory.js';
import { parseUberActivities } from '../utils/uberActivityParser.js';
import {
  buildRideMatches,
  MATCHABLE_ORIGINS,
  selectMatchableRides,
} from '../utils/uberRideMatch.js';
import { resolveCategoryId } from './financeSyncService.js';

const transactionSelect = {
  select: {
    id: true,
    amount: true,
    description: true,
    transactionDate: true,
    categoryId: true,
  },
};

const addOneDay = (date) => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
};

// `FinancialTransaction.description` is VarChar(255). The user-provided ride
// description is validated against that limit, but appending the linked sale
// reference can overflow it, so the base is trimmed to fit the suffix.
const MAX_DESCRIPTION_LENGTH = 255;

const withSaleReference = (description, orderNumber) => {
  const suffix = ` — Venda ${orderNumber}`;
  const available = MAX_DESCRIPTION_LENGTH - suffix.length;
  const base =
    description.length > available
      ? description.slice(0, available).trimEnd()
      : description;
  return `${base}${suffix}`;
};

const buildRideWhere = (userId, query = {}) => {
  const where = { userId };

  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;
  if (query.profileType) where.profileType = query.profileType;
  if (query.rideType) where.rideType = query.rideType;

  if (query.launched === 'yes') where.transaction = { isNot: null };
  if (query.launched === 'no') where.transaction = { is: null };

  if (query.from || query.to) {
    where.requestedAt = {};
    if (query.from) where.requestedAt.gte = parseLocalDate(query.from);
    if (query.to) where.requestedAt.lt = addOneDay(parseLocalDate(query.to));
  }

  if (query.q && query.q.trim()) {
    const term = query.q.trim();
    where.OR = [
      { destination: { contains: term, mode: 'insensitive' } },
      { riderName: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
};

const decorateRide = (ride) => ({
  ...ride,
  launched: Boolean(ride.transaction),
  transactionId: ride.transaction?.id ?? null,
});

// Ledger fields needed to render a match suggestion. The sale label mirrors the
// sale picker shape (`orderNumber`, first item's client name, total value).
const rideMatchTransactionSelect = {
  select: {
    id: true,
    origin: true,
    description: true,
    transactionDate: true,
    amount: true,
    orderId: true,
    order: {
      select: {
        orderNumber: true,
        totalValue: true,
        items: {
          select: { person: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    },
  },
};

// Suggests, per eligible ride, the existing ledger rows with the same value. One
// query fetches every candidate amount at once; the amount grouping lives in the
// pure `buildRideMatches` helper.
const findRideMatches = async (client, { userId, rides }) => {
  const candidates = selectMatchableRides(rides);
  if (candidates.length === 0) return new Map();

  const amounts = [...new Set(candidates.map((ride) => ride.amountCents))].map(
    (cents) => fromCents(cents).toFixed(2),
  );

  const transactions = await client.financialTransaction.findMany({
    where: {
      userId,
      type: 'DESPESA',
      rideId: null,
      origin: { in: MATCHABLE_ORIGINS },
      amount: { in: amounts },
    },
    ...rideMatchTransactionSelect,
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
  });

  return buildRideMatches(candidates, transactions);
};

const listRides = async (client, { userId, query }) => {
  const rides = await client.rideRecord.findMany({
    where: buildRideWhere(userId, query),
    include: { transaction: transactionSelect },
    orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const decorated = rides.map(decorateRide);
  const matches = await findRideMatches(client, { userId, rides: decorated });

  return decorated.map((ride) => ({
    ...ride,
    matches: matches.get(ride.id) ?? [],
  }));
};

// Upserts every parsed ride. Idempotent: the unique key keeps a re-import from
// creating duplicates, and `created`/`updated` let the caller report what
// changed. Cancelled rides are imported too (some places charge a cancellation
// fee) but are flagged so the UI never offers them for automatic launching.
const importRides = async (
  client,
  { userId, source = 'UBER_ACTIVITY_JSON', jsonText, windowStart, windowEnd },
) => {
  const { rides, warnings } = parseUberActivities(jsonText, {
    windowStart,
    windowEnd,
  });

  const importBatchId = randomUUID();
  let created = 0;
  let updated = 0;
  let cancelled = 0;

  for (const ride of rides) {
    const data = {
      userId,
      source,
      externalId: ride.externalId,
      profileType: ride.profileType,
      riderName: ride.riderName,
      requestedAt: ride.requestedAt,
      destination: ride.destination,
      amountCents: ride.amountCents,
      currency: ride.currency,
      status: ride.status,
      rideType: ride.rideType,
      importBatchId,
    };

    const existing = await client.rideRecord.findUnique({
      where: {
        userId_source_externalId: {
          userId,
          source,
          externalId: ride.externalId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await client.rideRecord.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await client.rideRecord.create({ data });
      created += 1;
    }

    if (ride.status === 'CANCELLED') cancelled += 1;
  }

  return {
    batchId: importBatchId,
    total: rides.length,
    created,
    updated,
    cancelled,
    warnings,
  };
};

// Default ledger description for a ride: "Uber — Destino (Familiar)".
const defaultRideDescription = (ride) => {
  const parts = ['Uber'];
  if (ride.destination) parts.push(`— ${ride.destination}`);
  if (ride.riderName) parts.push(`(${ride.riderName})`);
  return parts.join(' ');
};

// `RideRecord.requestedAt` stores the rider's local wall clock encoded as UTC,
// so the calendar day must be read from its UTC parts to compare with the
// `YYYY-MM-DD` invoice date without a timezone shift.
const rideDayString = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

// Credit-card fields for a launched ride. The ride date is the card charge date
// (kept as `transactionDate`) and the informed invoice date becomes the pending
// `effectiveDate`, which must not precede the ride.
const buildRideCardFields = (ride, payment) => {
  if (!payment) return {};

  if (rideDayString(ride.requestedAt) > payment.effectiveDate) {
    throw badRequest(
      'A data da fatura não pode ser anterior à data da corrida',
    );
  }

  return {
    paymentType: payment.type,
    effectiveDate: parseLocalDate(payment.effectiveDate),
    isEffective: false,
  };
};

// Resolves an optional sale link: it must be one of the user's own VENDA
// orders. Returns the resolved id plus the order number used in the description.
const resolveSale = async (client, { userId, orderId }) => {
  if (!orderId) return { orderId: null, orderNumber: null };

  const order = await client.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, orderType: true, orderNumber: true },
  });

  if (!order) {
    throw notFound('Venda não encontrada');
  }

  if (order.orderType !== 'VENDA') {
    throw badRequest('Apenas vendas podem ser vinculadas a uma corrida');
  }

  return { orderId: order.id, orderNumber: order.orderNumber };
};

// Ledger description for a launched/reconciled ride. Linked rows carry the sale
// reference, mirroring the other automatic ledger rows ("Venda V-0001 — Cliente").
const buildRowDescription = (item, ride, orderNumber) => {
  const baseDescription =
    item.description && item.description.trim()
      ? item.description.trim()
      : defaultRideDescription(ride);

  return orderNumber
    ? withSaleReference(baseDescription, orderNumber)
    : baseDescription;
};

// Creates one DESPESA row for a ride. The category defaults to the user's
// "Transporte" when not informed, and every informed category must be the user's
// and of type DESPESA. An optional `orderId` links the expense to the sale the
// ride delivered.
const createExpenseForRide = async (tx, { userId, ride, item, payment }) => {
  const { orderId, orderNumber } = await resolveSale(tx, {
    userId,
    orderId: item.orderId,
  });

  const categoryId =
    item.categoryId ?? (await resolveCategoryId(tx, userId, 'UBER'));
  await assertCategoryMatches(tx, userId, { categoryId, type: 'DESPESA' });

  return tx.financialTransaction.create({
    data: {
      userId,
      type: 'DESPESA',
      origin: 'UBER',
      amount: fromCents(ride.amountCents).toFixed(2),
      description: buildRowDescription(item, ride, orderNumber),
      transactionDate: ride.requestedAt,
      categoryId,
      orderId,
      rideId: ride.id,
      ...buildRideCardFields(ride, payment),
    },
    include: { category: true },
  });
};

// Origins an existing row may have to be reconciled with a ride. Automatic
// origins owned by their source (order, card bill) are rejected.
const RECONCILABLE_ORIGINS = new Set(['MANUAL', 'VENDA_ADICIONAL']);

// Turns an existing ledger row into the ride's expense: keeps its amount, date,
// category and payment state, and only re-identifies it as the Uber ride
// (origin, ride link, description) plus the sale link. A sale already linked to
// the row wins over the payload, so reconciling never reassigns an existing
// sale. An informed `transactionDate` overrides the stored date, so the user can
// correct a manual entry to the ride's actual date.
const reconcileExpenseWithRide = async (tx, { userId, ride, item }) => {
  const transaction = await tx.financialTransaction.findFirst({
    where: { id: item.matchTransactionId, userId },
  });

  if (!transaction) {
    throw notFound('Lançamento não encontrado');
  }

  if (transaction.type !== 'DESPESA') {
    throw badRequest('Apenas despesas podem ser conciliadas com uma corrida');
  }

  if (!RECONCILABLE_ORIGINS.has(transaction.origin)) {
    throw badRequest('Este lançamento não pode ser conciliado com uma corrida');
  }

  if (transaction.rideId) {
    throw badRequest('Este lançamento já está vinculado a outra corrida');
  }

  if (toCents(transaction.amount) !== ride.amountCents) {
    throw badRequest('O valor do lançamento não corresponde ao da corrida');
  }

  let orderId = transaction.orderId;
  let orderNumber = null;
  if (orderId) {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { orderNumber: true },
    });
    orderNumber = order?.orderNumber ?? null;
  } else {
    ({ orderId, orderNumber } = await resolveSale(tx, {
      userId,
      orderId: item.orderId,
    }));
  }

  return tx.financialTransaction.update({
    where: { id: transaction.id },
    data: {
      origin: 'UBER',
      rideId: ride.id,
      orderId,
      description: buildRowDescription(item, ride, orderNumber),
      ...(item.transactionDate && {
        transactionDate: parseLocalDate(item.transactionDate),
      }),
    },
    include: { category: true },
  });
};

// Creates one DESPESA ledger row per selected ride, or reconciles it with an
// existing row when `matchTransactionId` is informed. The whole batch is
// transactional: if any ride is missing, cancelled or already launched, nothing
// is written. An optional batch `payment` (CARTAO_CREDITO + invoice date) turns
// every newly created row into a pending card purchase; reconciliation never
// touches the existing row's payment state.
const createExpensesFromRides = async (
  client,
  { userId, items, payment = null },
) =>
  client.$transaction(async (tx) => {
    const rows = [];

    for (const item of items) {
      const ride = await tx.rideRecord.findFirst({
        where: { id: item.rideId, userId },
      });

      if (!ride) {
        throw notFound('Corrida não encontrada');
      }

      if (ride.status !== 'COMPLETED') {
        throw badRequest('Corridas canceladas não geram lançamento');
      }

      const existing = await tx.financialTransaction.findUnique({
        where: { rideId: ride.id },
        select: { id: true },
      });

      if (existing) {
        throw badRequest('Esta corrida já foi lançada no financeiro');
      }

      rows.push(
        item.matchTransactionId
          ? await reconcileExpenseWithRide(tx, { userId, ride, item })
          : await createExpenseForRide(tx, { userId, ride, item, payment }),
      );
    }

    return rows;
  });

// Removes a single ride the user discarded from the import list. Rides already
// linked to a ledger row are rejected so the expense is never orphaned (the
// relation is `onDelete: SetNull`, so an unguarded delete would silently strip
// the link). The `userId` in the lookup keeps the delete scoped to its owner,
// and a missing/foreign ride surfaces as a 404 without leaking existence.
const deleteRide = async (client, { userId, rideId }) => {
  const ride = await client.rideRecord.findFirst({
    where: { id: rideId, userId },
    include: { transaction: { select: { id: true } } },
  });

  if (!ride) {
    throw notFound('Corrida não encontrada');
  }

  if (ride.transaction) {
    throw badRequest(
      'Esta corrida já foi lançada no financeiro e não pode ser removida.',
    );
  }

  await client.rideRecord.delete({ where: { id: ride.id } });

  return { id: ride.id, removed: true };
};

// Removes the rides of an import batch that were not launched yet. Rides already
// linked to a ledger row are kept so the expense is never orphaned; the caller
// receives how many rows were kept for that reason. Idempotent.
const deleteRideBatch = async (client, { userId, batchId }) => {
  const removed = await client.rideRecord.deleteMany({
    where: { userId, importBatchId: batchId, transaction: { is: null } },
  });

  const kept = await client.rideRecord.count({
    where: { userId, importBatchId: batchId },
  });

  return { batchId, removed: removed.count, kept };
};

export {
  buildRideWhere,
  listRides,
  importRides,
  createExpensesFromRides,
  deleteRide,
  deleteRideBatch,
  defaultRideDescription,
};
