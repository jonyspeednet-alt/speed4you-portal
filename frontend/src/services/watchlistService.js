import apiClient from './apiClient';

export const watchlistService = {
  getAll: () => apiClient('/watchlist'),
  add: (contentType, contentId) => apiClient('/watchlist', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId }),
  }),
  remove: (id) => apiClient(`/watchlist/${id}`, { method: 'DELETE' }),
  check: (contentType, contentId) => apiClient(`/watchlist/check?contentType=${contentType}&contentId=${contentId}`),
};

export default watchlistService;