import api from './api';

export const listBills = () => api.get('/credit-cards/bills');

export const getBill = (id) => api.get(`/credit-cards/bills/${id}`);

export const createBill = (payload) => api.post('/credit-cards/bills', payload);

export const updateBill = (id, payload) =>
  api.put(`/credit-cards/bills/${id}`, payload);

export const deleteBill = (id) => api.delete(`/credit-cards/bills/${id}`);

export const payInstallment = (id, payload) =>
  api.post(`/credit-cards/installments/${id}/pay`, payload);

export const unpayInstallment = (id) =>
  api.post(`/credit-cards/installments/${id}/unpay`);

export const previewReconcile = (ofxText) =>
  api.post('/credit-cards/reconcile/preview', { ofxText });

export const commitReconcile = (payload) =>
  api.post('/credit-cards/reconcile/commit', payload);

export const undoReconcileBatch = (batchId) =>
  api.delete(`/credit-cards/reconcile/batch/${batchId}`);
