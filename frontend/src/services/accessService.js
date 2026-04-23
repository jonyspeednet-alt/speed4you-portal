import apiClient from './apiClient';

export const accessService = {
  checkAccess: () => apiClient('/access/check'),
  getStatus: () => apiClient('/access/status'),
  requestAccess: (reason) => apiClient('/access/request', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
};

export default accessService;