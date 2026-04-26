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

export const seriesService = {
  getById: (id) => apiClient(`/series/${id}`),
  list: (params) => apiClient(`/series?${toQueryString(params)}`),
  search: (query, params) => apiClient(`/search/series?q=${encodeURIComponent(query)}&${toQueryString(params)}`),
};

export default seriesService;
