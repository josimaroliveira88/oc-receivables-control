// Item-level pure helpers for the purchase-order write paths: payload-to-DB
// shaping and total-in-cents math.
import { lineValueCents } from './money.js';

const itemCreateData = (item) => ({
  description: item.description || null,
  chargedValue: item.chargedValue,
  personId: item.personId,
  productId: item.productId || null,
  memberPrice: item.memberPrice ?? null,
  details: item.details || null,
  quantity: item.quantity ?? 1,
  forStock: item.forStock ?? false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

const orderLineTotalCents = (items) =>
  items.reduce((sum, item) => sum + lineValueCents(item), 0);

export { itemCreateData, orderLineTotalCents };
