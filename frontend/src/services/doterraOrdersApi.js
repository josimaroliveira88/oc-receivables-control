import api from './api';

// Session-JWT endpoints for the dōTERRA orders import (`/api/doterra/orders`).
// The extension token path is used by the extension itself; the app always
// talks with the session JWT.

// `numbers` -> { existing: [...], missing: [...] }
export const lookup = (numbers) =>
  api.post('/doterra/orders/lookup', { numbers });

// `payload` is the captured JSON (`{ orders: [...] }`).
export const importOrders = (payload) =>
  api.post('/doterra/orders/import', payload);
