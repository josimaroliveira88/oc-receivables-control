import api from './api';

export const listRides = (params) => api.get('/uber/rides', { params });

export const importRides = (payload) => api.post('/uber/rides/import', payload);

export const createRideExpenses = (items, payment = null) =>
  api.post('/uber/rides/expenses', payment ? { items, payment } : { items });

export const deleteRide = (id) => api.delete(`/uber/rides/${id}`);

export const deleteRideBatch = (batchId) =>
  api.delete(`/uber/rides/batch/${batchId}`);
