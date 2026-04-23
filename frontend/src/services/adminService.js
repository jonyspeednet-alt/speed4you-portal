import apiClient from './apiClient';

export const adminService = {
  getDashboard: () => apiClient('/admin/dashboard'),
  getStats: () => apiClient('/admin/stats'),
  getScannerRoots: () => apiClient('/admin/scanner/roots'),
  getScannerHealth: () => apiClient('/admin/scanner/health'),
  getScannerLogs: (limit = 10) => apiClient(`/admin/scanner/logs?limit=${encodeURIComponent(limit)}`),
  getCurrentScannerJob: () => apiClient('/admin/scanner/jobs/current'),
  runScanner: (rootIds = []) => apiClient('/admin/scanner/run', {
    method: 'POST',
    body: JSON.stringify({ rootIds }),
  }),
  getMediaNormalizerStatus: () => apiClient('/admin/media-normalizer/status'),
  startMediaNormalizer: () => apiClient('/admin/media-normalizer/start', { method: 'POST' }),
  stopMediaNormalizer: () => apiClient('/admin/media-normalizer/stop', { method: 'POST' }),
  getDuplicateReview: () => apiClient('/admin/duplicates/review'),
  runDuplicateCleanup: () => apiClient('/admin/duplicates/cleanup', { method: 'POST' }),
  getScannerDrafts: (status = 'draft') => apiClient(`/admin/scanner/drafts?status=${encodeURIComponent(status)}`),
  
  // Content management
  getContent: (params = {}) => apiClient(`/admin/content?${new URLSearchParams(params)}`),
  getContentOrganization: (params = {}) => apiClient(`/admin/content/organization?${new URLSearchParams(params)}`),
  getContentById: (id) => apiClient(`/admin/content/${id}`),
  createContent: (data) => apiClient('/admin/content', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateContent: (id, data) => apiClient(`/admin/content/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  bulkUpdateContent: (ids, changes) => apiClient('/admin/content/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ ids, changes }),
  }),
  deleteContent: (id) => apiClient(`/admin/content/${id}`, { method: 'DELETE' }),
  publishContent: (id) => apiClient(`/admin/content/${id}/publish`, { method: 'POST' }),
  unpublishContent: (id) => apiClient(`/admin/content/${id}/unpublish`, { method: 'POST' }),
  
  // Movies
  getMovies: (params = {}) => apiClient(`/admin/movies?${new URLSearchParams(params)}`),
  
  // Series
  getSeries: (params = {}) => apiClient(`/admin/series?${new URLSearchParams(params)}`),
  
  // Media uploads
  uploadPoster: (file) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const response = await apiClient('/admin/upload/poster', {
            method: 'POST',
            body: JSON.stringify({ dataUrl: reader.result }),
          });
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read poster file.'));
      reader.readAsDataURL(file);
    });
  },
  uploadBanner: (file) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const response = await apiClient('/admin/upload/banner', {
            method: 'POST',
            body: JSON.stringify({ dataUrl: reader.result }),
          });
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read banner file.'));
      reader.readAsDataURL(file);
    });
  },
  importTmdbMetadata: (tmdbId, type = 'movie') => apiClient('/admin/metadata/tmdb', {
    method: 'POST',
    body: JSON.stringify({ tmdbId, type }),
  }),
};

export default adminService;
