import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  parseInfinitePayCsv,
  InfinitePayCsvError,
} from '../utils/csvParser.js';
import {
  decorateSaleForMatch,
  matchRowToSales,
} from '../utils/infinitepayHelpers.js';

// POST /api/sales/infinitepay/import
// Parses an InfinitePay statement (multipart `file`), validates its layout and
// matches each approved row against the user's open sales. Denied rows are
// discarded and counted. Any out-of-pattern file is rejected with 400.
const importInfinitePayStatement = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Envie o arquivo CSV do InfinitePay' });
    }

    const parsedRows = parseInfinitePayCsv(req.file.buffer.toString('utf8'));

    const approvedRows = parsedRows.filter((row) => row.status !== 'Negada');
    const ignoredCount = parsedRows.length - approvedRows.length;

    const orders = await prisma.order.findMany({
      where: {
        userId: req.user.userId,
        orderType: 'VENDA',
        isTeamOrder: false,
        status: { not: 'QUITADO' },
      },
      include: {
        items: { include: { person: true } },
        payments: true,
      },
    });

    // Only sales that still have something to receive are candidates.
    const sales = orders
      .map(decorateSaleForMatch)
      .filter((sale) => sale.pendingCents > 0);

    const rows = approvedRows.map((row) => ({
      ...row,
      matches: matchRowToSales(row, sales),
    }));

    res.status(200).json({ ignoredCount, rows });
  } catch (error) {
    if (error instanceof InfinitePayCsvError) {
      return res.status(400).json({ error: error.message, line: error.line });
    }
    handleError(res, error, {
      label: 'Error importing InfinitePay statement',
    });
  }
};

export { importInfinitePayStatement };
