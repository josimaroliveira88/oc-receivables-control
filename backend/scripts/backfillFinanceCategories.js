// One-off maintenance script. Seeds the default finance categories for every
// existing user, so the finances module works for accounts created before the
// feature landed. Registration already seeds new users.
//
// Safe to run more than once: `ensureDefaultCategories` upserts by the
// `[userId, type, name]` unique constraint and never duplicates rows.
//
// Usage:
//   node scripts/backfillFinanceCategories.js [--dry-run]
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {
  DEFAULT_CATEGORIES,
  ensureDefaultCategories,
} from '../src/utils/financeDefaults.js';

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    dryRun
      ? '=== Simulação (nenhuma alteração aplicada) ==='
      : '=== Backfill de categorias financeiras ===',
  );

  for (const user of users) {
    if (!dryRun) {
      await ensureDefaultCategories(user.id, prisma);
    }
    console.log(`  ${user.username}: ${DEFAULT_CATEGORIES.length} categorias`);
  }

  console.log(
    `${users.length} usuário(s) ${dryRun ? 'a processar' : 'processado(s)'}.`,
  );
}

run()
  .catch((error) => {
    console.error('Erro ao criar as categorias financeiras padrão:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
