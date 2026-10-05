import api from './api';

// Lightweight VENDA options for autocomplete pickers (Uber ride → sale link).
export const listSaleOptions = (params) =>
  api.get('/sales/options', { params });
