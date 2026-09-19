// One-off maintenance script. Recomputes every order's status from its current
// items and payments, honoring shipping and additional values, and persists the
// corrections. Fixes statuses left stale by the historical payment bug that
// ignored `additionalValue` whenever a payment updated an order's status.
//
// Usage:
//   node scripts/resyncOrderStatuses.js [--dry-run]
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { syncOrderStatuses } from '../src/utils/receivables.js';

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const orders = await prisma.order.findMany({ select: { id: true } });
  const changes = await syncOrderStatuses(
    prisma,
    orders.map((order) => order.id),
    { dryRun },
  );

  console.log(
    dryRun
      ? '=== Simulação (nenhuma alteração aplicada) ==='
      : '=== Resultado da ressincronização ===',
  );

  if (changes.length === 0) {
    console.log('Nenhum status divergente encontrado.');
    return;
  }

  changes.forEach((change) => {
    console.log(`  ${change.id}: ${change.from} -> ${change.to}`);
  });
  console.log(
    `${changes.length} status(es) ${dryRun ? 'a corrigir' : 'corrigido(s)'}.`,
  );
}

run()
  .catch((error) => {
    console.error('Erro ao ressincronizar os status:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
