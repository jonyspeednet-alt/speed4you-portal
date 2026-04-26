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
  // Query-friendly methods for React Query
  fetchBrowsePage: async ({ pageParam = 1, ...filters }) => {
    const params = { ...filters, page: pageParam, limit: 24 };
    const response = await apiClient(`/content/browse?${toQueryString(params)}`);
    return {
      items: response.items || [],
      nextPage: response.nextPage ?? undefined,
      total: response.total || 0,
    };
  },
  fetchContent: (endpoint, params = {}) => apiClient(`${endpoint}?${toQueryString(params)}`),
  fetchHomepage: () => apiClient('/content/homepage'),
  fetchLatest: (limit = 10) => apiClient(`/content/latest?limit=${limit}`),
  fetchPopular: (limit = 10) => apiClient(`/content/popular?limit=${limit}`),
  fetchTrending: (limit = 10) => apiClient(`/content/trending?limit=${limit}`),
};

export default contentService;
