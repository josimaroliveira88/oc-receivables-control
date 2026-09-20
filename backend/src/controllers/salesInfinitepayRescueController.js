import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { BankStatementCsvError } from '../utils/bankStatementParser.js';
import {
  previewRescueImport,
  commitRescueImport,
} from '../services/infinitepayRescueService.js';
import { commitRescueSchema } from '../validators/rescueValidator.js';

// POST /api/sales/infinitepay-rescues/import
// Parses the InfinitePay bank statement (multipart `file`) and returns every
// redemption paired with the sales that match its amount and its source
// deposits. Nothing is persisted: the user confirms the picks in the modal.
// Any out-of-pattern file is rejected with 400.
const importInfinitePayRescues = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Envie o arquivo CSV do extrato bancário' });
    }

    const preview = await previewRescueImport(prisma, {
      userId: req.user.userId,
      csvText: req.file.buffer.toString('utf8'),
    });

    res.status(200).json(preview);
  } catch (error) {
    if (error instanceof BankStatementCsvError) {
      return res.status(400).json({ error: error.message, line: error.line });
    }
    handleError(res, error, {
      label: 'Error importing InfinitePay rescues',
    });
  }
};

// POST /api/sales/infinitepay-rescues/commit
// Creates the confirmed redemptions, tagged with the batch id returned by the
// import preview, so the whole import can be undone afterwards.
const commitInfinitePayRescues = async (req, res) => {
  try {
    const payload = commitRescueSchema.parse(req.body);
    const created = await commitRescueImport(prisma, {
      userId: req.user.userId,
      payload,
    });

    res.status(201).json({ batchId: payload.batchId, created });
  } catch (error) {
    handleError(res, error, {
      label: 'Error committing InfinitePay rescues',
    });
  }
};

export { importInfinitePayRescues, commitInfinitePayRescues };
