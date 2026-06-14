import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxiosInstance = vi.hoisted(() => ({
  mockRequestUse: vi.fn(),
  mockResponseUse: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: mockAxiosInstance.interceptors.request.use },
        response: { use: mockAxiosInstance.interceptors.response.use },
      },
    })),
  },
}));

import api from '../src/services/api';

describe('API Interceptors', () => {
  let onRequest;
  let onResponseError;

  beforeEach(() => {
    localStorage.clear();
    [onRequest] = mockAxiosInstance.interceptors.request.use.mock.calls[0];
    [, onResponseError] = mockAxiosInstance.interceptors.response.use.mock.calls[0];
    delete window.location;
    window.location = { href: '' };
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header with Bearer token when token exists in localStorage', () => {
      localStorage.setItem('token', 'test-token-abc');
      const config = { headers: {} };
      const result = onRequest(config);
      expect(result.headers.Authorization).toBe('Bearer test-token-abc');
    });

    it('should not add Authorization header when no token in localStorage', () => {
      const config = { headers: {} };
      const result = onRequest(config);
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should return the config object', () => {
      const config = { headers: {}, url: '/test' };
      const result = onRequest(config);
      expect(result).toBe(config);
    });
  });

  describe('Response Interceptor - 401 handling', () => {
    it('should clear token and redirect to /login on 401', async () => {
      localStorage.setItem('token', 'old-token');
      const error = { response: { status: 401 } };

      await expect(onResponseError(error)).rejects.toBe(error);
      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('should call Promise.reject with the original error on 401', async () => {
      const error = { response: { status: 401 }, message: 'Unauthorized' };
      await expect(onResponseError(error)).rejects.toBe(error);
    });
  });

  describe('Response Interceptor - 403 handling (expired token)', () => {
    it('should clear token and redirect to /login on 403', async () => {
      localStorage.setItem('token', 'expired-token');
      const error = { response: { status: 403 } };

      await expect(onResponseError(error)).rejects.toBe(error);
      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('should call Promise.reject with the original error on 403', async () => {
      const error = { response: { status: 403 }, message: 'Invalid or expired token' };
      await expect(onResponseError(error)).rejects.toBe(error);
    });
  });

  describe('Response Interceptor - other errors', () => {
    it('should NOT clear token or redirect on 500', async () => {
      localStorage.setItem('token', 'my-token');
      const error = { response: { status: 500 } };

      await expect(onResponseError(error)).rejects.toBe(error);
      expect(localStorage.getItem('token')).toBe('my-token');
      expect(window.location.href).toBe('');
    });

    it('should NOT clear token or redirect on 400', async () => {
      localStorage.setItem('token', 'my-token');
      const error = { response: { status: 400 } };

      await expect(onResponseError(error)).rejects.toBe(error);
      expect(localStorage.getItem('token')).toBe('my-token');
      expect(window.location.href).toBe('');
    });

    it('should NOT clear token or redirect on network error (no response)', async () => {
      localStorage.setItem('token', 'my-token');
      const error = { message: 'Network Error' };

      await expect(onResponseError(error)).rejects.toBe(error);
      expect(localStorage.getItem('token')).toBe('my-token');
      expect(window.location.href).toBe('');
    });
  });
});
