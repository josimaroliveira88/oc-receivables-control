const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardData = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
      },
    });

    const allPayments = await prisma.payment.findMany({
      include: {
        person: true,
      },
    });

    let totalPending = 0;
    let totalPaid = 0;

    for (const order of orders) {
      const orderPaymentSum = order.payments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      const orderTotal = parseFloat(order.totalValue);

      if (order.status === 'QUITADO') {
        totalPaid += orderTotal;
      } else {
        const orderPending = orderTotal - orderPaymentSum;
        totalPending += orderPending > 0 ? orderPending : 0;
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthReceipts = allPayments
      .filter((p) => {
        const paidAt = new Date(p.paidAt);
        return (
          paidAt.getFullYear() === currentYear &&
          paidAt.getMonth() === currentMonth
        );
      })
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const personMap = new Map();

    for (const order of orders) {
      for (const item of order.items) {
        const pid = item.personId || 'unknown';
        const name = item.person ? item.person.name : 'Sem pessoa';

        if (!personMap.has(pid)) {
          personMap.set(pid, { personId: pid, personName: name, itemTotal: 0, paymentTotal: 0 });
        }
        personMap.get(pid).itemTotal += parseFloat(item.value);
      }

      for (const payment of order.payments) {
        const pid = payment.personId || 'unknown';
        const name = payment.person ? payment.person.name : 'Sem pessoa';

        if (!personMap.has(pid)) {
          personMap.set(pid, { personId: pid, personName: name, itemTotal: 0, paymentTotal: 0 });
        }
        personMap.get(pid).paymentTotal += parseFloat(payment.amount);
      }
    }

    const personBalances = Array.from(personMap.values())
      .map((entry) => ({
        ...entry,
        pending: Math.max(0, entry.itemTotal - entry.paymentTotal),
      }))
      .sort((a, b) => a.personName.localeCompare(b.personName));

    res.status(200).json({
      totalPending,
      totalPaid,
      currentMonthReceipts,
      personBalances,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getDashboardData };
