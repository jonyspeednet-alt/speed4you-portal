import apiClient from './apiClient';

function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}

export const contentService = {
  getFeatured: () => apiClient('/content/featured'),
  getLatest: (limit = 10) => apiClient(`/content/latest?limit=${limit}`),
  getPopular: (limit = 10) => apiClient(`/content/popular?limit=${limit}`),
  getTrending: (limit = 10) => apiClient(`/content/trending?limit=${limit}`),
  browse: (params) => apiClient(`/content/browse?${toQueryString(params)}`),
  getHomepage: () => apiClient('/content/homepage'),
};

export default contentService;
