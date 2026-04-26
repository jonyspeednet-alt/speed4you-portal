import apiClient from './apiClient';

export const moviesService = {
  getAll: (params) => apiClient(`/movies?${new URLSearchParams(params)}`),
  getById: (id) => apiClient(`/movies/${id}`),
};

export default moviesService;
