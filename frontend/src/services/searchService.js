import apiClient from './apiClient';

function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export const searchService = {
  search: (query, filters = {}) => {
    const params = toQueryString({ q: query, ...filters });
    return apiClient(`/search?${params}`);
  },
  getSuggestions: (query) => apiClient(`/search/suggestions?${toQueryString({ q: query })}`),
  getRecentSearches: () => apiClient('/search/recent'),
};

export default searchService;
