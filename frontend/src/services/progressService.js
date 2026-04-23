import apiClient from './apiClient';

export const progressService = {
  getAll: () => apiClient('/progress'),
  update: (contentType, contentId, position, duration) => apiClient('/progress', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId, position, duration }),
  }),
  getFor: (contentType, contentId) => apiClient(`/progress/${contentType}/${contentId}`),
  markComplete: (contentType, contentId) => apiClient('/progress/complete', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId }),
  }),
  getContinueWatching: () => apiClient('/progress/continue-watching'),
};

export default progressService;