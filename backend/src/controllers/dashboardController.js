const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { buildDashboardSummary } = require('../utils/dashboardProjection');

const getDashboardData = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.userId, isTeamOrder: false },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
      },
    });

    const orderIds = orders.map((o) => o.id);

    const allPayments = await prisma.payment.findMany({
      where: {
        orderId: { in: orderIds },
      },
      include: {
        person: true,
      },
    });

    const summary = buildDashboardSummary(orders, allPayments, {
      currentDate: new Date(),
    });

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getDashboardData };
