// One-off maintenance script. Backfills the finances ledger from data that
// predates the module: every dōTERRA purchase order (COMPRA, non-team) becomes
// an expense and every sale payment (VENDA, non-team, non-InfinitePay) becomes
// an income. Also seeds the default finance categories for every user.
//
// Safe to run more than once: the sync helpers upsert rows keyed by order /
// payment, so nothing is duplicated. Purchase orders shared by more than one
// client use the order's displayed total (`totalValue`), matching the runtime
// rule in `financeSyncService.js`.
//
// Usage:
//   node scripts/backfillFinancialTransactions.js [--dry-run]
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { ensureDefaultCategories } from '../src/utils/financeDefaults.js';
import {
  shouldSyncIncome,
  syncExpenseFromOrder,
  syncIncomeFromPayment,
} from '../src/services/financeSyncService.js';

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
      : '=== Backfill de transações financeiras ===',
  );

  let totalExpenses = 0;
  let totalIncomes = 0;

  for (const user of users) {
    const [orders, payments] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id, orderType: 'COMPRA', isTeamOrder: false },
      }),
      prisma.payment.findMany({
        where: {
          order: { userId: user.id, orderType: 'VENDA', isTeamOrder: false },
        },
        include: { order: true },
      }),
    ]);

    if (dryRun) {
      const incomes = payments.filter((payment) =>
        shouldSyncIncome({ payment, order: payment.order }),
      ).length;
      totalExpenses += orders.length;
      totalIncomes += incomes;
      console.log(
        `  ${user.username}: ${orders.length} despesa(s), ${incomes} receita(s)`,
      );
      continue;
    }

    let expenses = 0;
    let incomes = 0;

    await prisma.$transaction(
      async (tx) => {
        await ensureDefaultCategories(user.id, tx);

        for (const order of orders) {
          const row = await syncExpenseFromOrder(tx, {
            userId: user.id,
            order,
          });
          if (row) expenses += 1;
        }

        for (const payment of payments) {
          const row = await syncIncomeFromPayment(tx, {
            userId: user.id,
            payment,
            order: payment.order,
          });
          if (row) incomes += 1;
        }
      },
      { timeout: 60000 },
    );

    totalExpenses += expenses;
    totalIncomes += incomes;
    console.log(
      `  ${user.username}: ${expenses} despesa(s), ${incomes} receita(s)`,
    );
  }

  console.log(
    `${users.length} usuário(s): ${totalExpenses} despesa(s), ${totalIncomes} receita(s) ${
      dryRun ? 'a processar' : 'processado(s)'
    }.`,
  );
}

run()
  .catch((error) => {
    console.error('Erro no backfill das transações financeiras:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
