// Translates a thrown error into the HTTP response inside a controller catch.
// Controllers keep a thin try/catch and delegate here, so error mapping
// (Zod validation, `.status` business rejections, unexpected failures) lives
// in a single place. Error factories live in utils/httpError.js.
const { ZodError } = require('zod');

const GENERIC_ERROR_MESSAGE = 'Internal server error';

const handleError = (res, error, { fallback = 500, label = 'Error' } = {}) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.errors });
  }

  if (error.status) {
    const body = { error: error.message };
    // stockUndoService attaches these extras on the order-lock rejection so
    // the frontend can deep-link to the owning order/venda.
    if (error.orderNumber !== undefined) body.orderNumber = error.orderNumber;
    if (error.orderId !== undefined) body.orderId = error.orderId;
    return res.status(error.status).json(body);
  }

  console.error(`${label}:`, error);
  res.status(fallback).json({ error: GENERIC_ERROR_MESSAGE });
};

module.exports = { handleError };
