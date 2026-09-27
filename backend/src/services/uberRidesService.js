// Uber ride persistence and ledger integration. Rides parsed from the pasted
// activity JSON are upserted by `(userId, source, externalId)` so re-importing
// the same JSON is idempotent, and each ride can generate at most one expense
// (enforced by the unique `FinancialTransaction.rideId`). All reads/writes are
// scoped by `userId`.
import { randomUUID } from 'node:crypto';
import { fromCents } from '../utils/money.js';
import { parseLocalDate } from '../utils/date.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { assertCategoryMatches } from '../utils/financeCategory.js';
import { parseUberActivities } from '../utils/uberActivityParser.js';
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

const listRides = async (client, { userId, query }) => {
  const rides = await client.rideRecord.findMany({
    where: buildRideWhere(userId, query),
    include: { transaction: transactionSelect },
    orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return rides.map(decorateRide);
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

// Creates one DESPESA ledger row per selected ride. The whole batch is
// transactional: if any ride is missing, cancelled or already launched, nothing
// is written. The category defaults to the user's "Transporte" when not
// informed, and every informed category must be the user's and of type DESPESA.
const createExpensesFromRides = async (client, { userId, items }) =>
  client.$transaction(async (tx) => {
    const created = [];

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

      const categoryId =
        item.categoryId ?? (await resolveCategoryId(tx, userId, 'UBER'));
      await assertCategoryMatches(tx, userId, { categoryId, type: 'DESPESA' });

      const description =
        item.description && item.description.trim()
          ? item.description.trim()
          : defaultRideDescription(ride);

      const row = await tx.financialTransaction.create({
        data: {
          userId,
          type: 'DESPESA',
          origin: 'UBER',
          amount: fromCents(ride.amountCents).toFixed(2),
          description,
          transactionDate: ride.requestedAt,
          categoryId,
          rideId: ride.id,
        },
        include: { category: true },
      });

      created.push(row);
    }

    return created;
  });

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
  deleteRideBatch,
  defaultRideDescription,
};
