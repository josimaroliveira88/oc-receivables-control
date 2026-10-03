import api from './api';

// Session-JWT-only endpoints (`/api/api-tokens`). The cleartext token is
// returned exactly once by `create`; `list` only ever exposes `lastFour`.
export const list = () => api.get('/api-tokens');

export const create = (payload) => api.post('/api-tokens', payload);

export const remove = (id) => api.delete(`/api-tokens/${id}`);
