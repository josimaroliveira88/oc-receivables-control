// Financial category CRUD. Categories are purely organisational: a transaction
// may have no category or a custom one, and deactivation is always soft so
// financial history is never lost. `client` is a Prisma client (or transaction
// client) and every read/write is scoped by `userId`.
import { ensureDefaultCategories } from '../utils/financeDefaults.js';
import { conflict, notFound } from '../utils/httpError.js';

// Seeds the default categories the first time a user accesses the module.
// Guarded by the `isDefault` count (not by "zero categories") so a renamed
// default is never recreated behind the user's back on the next visit.
const ensureDefaultsOnce = async (client, userId) => {
  const defaultCount = await client.financialCategory.count({
    where: { userId, isDefault: true },
  });

  if (defaultCount === 0) {
    await ensureDefaultCategories(userId, client);
  }
};

const listCategories = async (client, userId) => {
  await ensureDefaultsOnce(client, userId);

  return client.financialCategory.findMany({
    where: { userId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
};

const findCategoryByName = (client, userId, { type, name }) =>
  client.financialCategory.findFirst({ where: { userId, type, name } });

const createCategory = async (client, userId, { name, type }) => {
  const existing = await findCategoryByName(client, userId, { type, name });
  if (existing) {
    throw conflict('Category already exists');
  }

  return client.financialCategory.create({
    data: { userId, name, type, isDefault: false, active: true },
  });
};

const updateCategory = async (client, userId, id, { name, active }) => {
  const existing = await client.financialCategory.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw notFound('Category not found');
  }

  if (name !== undefined && name !== existing.name) {
    const duplicate = await findCategoryByName(client, userId, {
      type: existing.type,
      name,
    });
    if (duplicate && duplicate.id !== id) {
      throw conflict('Category already exists');
    }
  }

  return client.financialCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(active !== undefined && { active }),
    },
  });
};

const deactivateCategory = async (client, userId, id) => {
  const existing = await client.financialCategory.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw notFound('Category not found');
  }

  return client.financialCategory.update({
    where: { id },
    data: { active: false },
  });
};

export {
  ensureDefaultsOnce,
  listCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
};
