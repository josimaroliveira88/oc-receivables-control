// Shared guard for linking a financial transaction to one of the user's
// categories. Kept in `utils/` so both the manual-transaction service and the
// automatic sync service depend on the same rule without importing each other.
import { badRequest } from './httpError.js';

// A category, when informed, must belong to the user and match the entry type.
// `null`/`undefined` is valid and means "no category".
const assertCategoryMatches = async (client, userId, { categoryId, type }) => {
  if (categoryId === undefined || categoryId === null) return;

  const category = await client.financialCategory.findFirst({
    where: { id: categoryId, userId },
  });

  if (!category) {
    throw badRequest('Categoria não encontrada');
  }

  if (category.type !== type) {
    throw badRequest(
      'O tipo da categoria não corresponde ao tipo da transação',
    );
  }
};

export { assertCategoryMatches };
