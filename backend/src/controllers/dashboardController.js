const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { toCents, fromCents } = require('../utils/money');

const getDashboardData = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.userId },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
      },
    });

    const orderIds = orders.map(o => o.id);

    const allPayments = await prisma.payment.findMany({
      where: {
        orderId: { in: orderIds },
      },
      include: {
        person: true,
      },
    });

    let totalPendingCents = 0;
    let totalPaidCents = 0;

    for (const order of orders) {
      const orderPaymentSumCents = order.payments.reduce(
        (sum, p) => sum + toCents(p.amount),
        0
      );
      const orderTotalCents = toCents(order.totalValue);

      if (order.status === 'QUITADO') {
        totalPaidCents += orderTotalCents;
      } else {
        const orderPendingCents = orderTotalCents - orderPaymentSumCents;
        totalPendingCents += orderPendingCents > 0 ? orderPendingCents : 0;
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthReceiptsCents = allPayments
      .filter((p) => {
        const paidAt = new Date(p.paidAt);
        return (
          paidAt.getFullYear() === currentYear &&
          paidAt.getMonth() === currentMonth
        );
      })
      .reduce((sum, p) => sum + toCents(p.amount), 0);

    const personMap = new Map();

    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.personId || 'unknown';
        const name = item.person ? item.person.name : 'Sem pessoa';

        if (!personMap.has(pid)) {
          personMap.set(pid, { personId: pid, personName: name, itemTotalCents: 0, paymentTotalCents: 0 });
        }
        personMap.get(pid).itemTotalCents += toCents(item.value);
      }

      for (const payment of order.payments) {
        const pid = payment.personId || 'unknown';
        const name = payment.person ? payment.person.name : 'Sem pessoa';

        if (!personMap.has(pid)) {
          personMap.set(pid, { personId: pid, personName: name, itemTotalCents: 0, paymentTotalCents: 0 });
        }
        personMap.get(pid).paymentTotalCents += toCents(payment.amount);
      }
    }

    const personBalances = Array.from(personMap.values())
      .map((entry) => {
        const pendingCents = entry.itemTotalCents - entry.paymentTotalCents;
        return {
          personId: entry.personId,
          personName: entry.personName,
          itemTotal: fromCents(entry.itemTotalCents),
          paymentTotal: fromCents(entry.paymentTotalCents),
          pending: fromCents(Math.max(0, pendingCents)),
        };
      })
      .sort((a, b) => a.personName.localeCompare(b.personName));

    const yearMap = new Map();

    for (const order of orders) {
      const year = order.orderDate.getFullYear();
      const orderTotalCents = toCents(order.totalValue);

      if (!yearMap.has(year)) {
        yearMap.set(year, { year, totalPendingCents: 0, totalQuitadoCents: 0 });
      }

      const entry = yearMap.get(year);
      if (order.status === 'QUITADO') {
        entry.totalQuitadoCents += orderTotalCents;
      } else {
        entry.totalPendingCents += orderTotalCents;
      }
    }

    const yearlyBreakdown = Array.from(yearMap.values())
      .map((entry) => ({
        year: entry.year,
        totalPending: fromCents(entry.totalPendingCents),
        totalQuitado: fromCents(entry.totalQuitadoCents),
      }))
      .sort((a, b) => b.year - a.year);

    res.status(200).json({
      totalPending: fromCents(totalPendingCents),
      totalPaid: fromCents(totalPaidCents),
      currentMonthReceipts: fromCents(currentMonthReceiptsCents),
      personBalances,
      yearlyBreakdown,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getDashboardData };
