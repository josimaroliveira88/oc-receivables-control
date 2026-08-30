const { z } = require('zod');

// Must stay in sync with the Prisma `PaymentType` enum. Used both for the
// order-level "how the user paid dōTERRA" field and for per-payment records
// ("how the client paid the user").
const paymentTypeSchema = z.enum([
  'PIX',
  'BOLETO',
  'CARTAO_CREDITO',
  'INFINITE_PAY',
]);

module.exports = { paymentTypeSchema };
