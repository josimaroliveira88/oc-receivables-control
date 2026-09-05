// Shared factories for HTTP-mapped business errors. Pure functions: they only
// create an Error carrying a `.status` so controllers/middlewares translate it
// into the HTTP response (see middlewares/errorResponse.js).

const badRequest = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const notFound = (message) => {
  const error = new Error(message);
  error.status = 404;
  return error;
};

const forbidden = (message) => {
  const error = new Error(message);
  error.status = 403;
  return error;
};

module.exports = { badRequest, notFound, forbidden };
