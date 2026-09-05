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
  useCashback: item.useCashback ?? false,
  chargedValueMode: item.chargedValueMode ?? 'UNIT',
  kitStockMode: item.kitStockMode ?? null,
  ...(item.kitSnapshot !== undefined
    ? { kitSnapshot: item.kitSnapshot ?? null }
    : {}),
});

// Resolves per-item defaults for purchase orders.
// - Non-team orders always belong to the user themselves: items without an
//   explicit person are bound to the self person, and `forStock` defaults to
//   true when the item references a catalog product (there is nothing to stock
//   without a product). Explicitly-provided values (legacy data or API
//   clients) are preserved so records can be migrated gradually.
// - Team orders record someone else's order for reference: items keep their
//   person when provided, never affect the user's stock, and default
//   `useCashback` to false.
const resolveItemDefaults = ({
  items,
  isTeamOrder = false,
  selfPersonId = null,
}) =>
  items.map((item) => {
    const useCashback = item.useCashback ?? false;
    if (isTeamOrder) {
      return {
        ...item,
        personId: item.personId || null,
        forStock: false,
        useCashback,
      };
    }
    const isSelfBound = !item.personId || item.personId === selfPersonId;
    return {
      ...item,
      personId: item.personId || selfPersonId,
      forStock:
        item.forStock ?? Boolean(item.productId && selfPersonId && isSelfBound),
      useCashback,
    };
  });

const orderLineTotalCents = (items) =>
  items.reduce((sum, item) => sum + lineValueCents(item), 0);

export { itemCreateData, resolveItemDefaults, orderLineTotalCents };
