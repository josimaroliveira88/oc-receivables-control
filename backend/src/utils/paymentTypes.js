import { z } from 'zod';

// Must stay in sync with the Prisma `PaymentType` enum. Used both for the
// order-level "how the user paid dōTERRA" field and for per-payment records
// ("how the client paid the user").
const paymentTypeSchema = z.enum([
  'PIX',
  'BOLETO',
  'CARTAO_CREDITO',
  'INFINITE_PAY',
  'DINHEIRO',
  'DOTERRA',
]);

// Payment types that only make sense on an order whose total is zero (a free
// order covered by dōTERRA). Every path that persists an order total must
// reject the combination, so the invariant holds no matter how the total was
// reached (create, edit, item add/update or the dōTERRA import).
const ZERO_TOTAL_ONLY_PAYMENT_TYPES = ['DOTERRA'];

const ZERO_TOTAL_PAYMENT_TYPE_MESSAGE =
  'O tipo de pagamento dōTERRA só pode ser usado quando o valor total do pedido é igual a zero';

// Whether a payment type requires a zero order total.
const requiresZeroTotal = (paymentType) =>
  ZERO_TOTAL_ONLY_PAYMENT_TYPES.includes(paymentType);

export {
  paymentTypeSchema,
  requiresZeroTotal,
  ZERO_TOTAL_ONLY_PAYMENT_TYPES,
  ZERO_TOTAL_PAYMENT_TYPE_MESSAGE,
};
