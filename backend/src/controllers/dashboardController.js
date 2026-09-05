import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { buildDashboardSummary } from '../utils/dashboardProjection.js';

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
    handleError(res, error, { label: 'Error fetching dashboard data' });
  }
};

export { getDashboardData };
