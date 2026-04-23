import apiClient from './apiClient';

export const authService = {
  login: (username, password) => apiClient('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  logout: () => apiClient('/auth/logout', { method: 'POST' }),
  verify: () => apiClient('/auth/verify', { method: 'POST' }),
  refresh: () => apiClient('/auth/refresh', { method: 'POST' }),
};

export default authService;
