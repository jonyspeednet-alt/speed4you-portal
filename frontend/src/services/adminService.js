import apiClient from './apiClient';

const ADMIN_CACHE_TTL_MS = 12000;
const adminCache = new Map();

function buildCacheKey(path, params = {}) {
  return `${path}?${new URLSearchParams(params)}`;
}

async function cachedGet(path, params = {}, ttl = ADMIN_CACHE_TTL_MS) {
  const key = buildCacheKey(path, params);
  const now = Date.now();
  const cached = adminCache.get(key);
  if (cached && now - cached.at < ttl) {
    return cached.data;
  }

  const data = await apiClient(`${path}?${new URLSearchParams(params)}`);
  adminCache.set(key, { at: now, data });
  return data;
}

function clearAdminCache() {
  adminCache.clear();
}

export const adminService = {
  getDashboard: () => cachedGet('/admin/dashboard'),
  getStats: () => cachedGet('/admin/stats'),
  getScannerRoots: () => cachedGet('/admin/scanner/roots'),
  getScannerHealth: () => cachedGet('/admin/scanner/health'),
  getScannerLogs: (limit = 10) => cachedGet('/admin/scanner/logs', { limit }),
  getCurrentScannerJob: () => apiClient('/admin/scanner/jobs/current'),
  runScanner: (rootIds = []) => apiClient('/admin/scanner/run', {
    method: 'POST',
    body: JSON.stringify({ rootIds }),
  }).finally(clearAdminCache),
  stopScanner: () => apiClient('/admin/scanner/stop', { method: 'POST' }).finally(clearAdminCache),
  getMediaNormalizerStatus: () => apiClient('/admin/media-normalizer/status'),
  startMediaNormalizer: () => apiClient('/admin/media-normalizer/start', { method: 'POST' }).finally(clearAdminCache),
  stopMediaNormalizer: () => apiClient('/admin/media-normalizer/stop', { method: 'POST' }).finally(clearAdminCache),
  getDuplicateReview: () => cachedGet('/admin/duplicates/review'),
  runDuplicateCleanup: () => apiClient('/admin/duplicates/cleanup', { method: 'POST' }).finally(clearAdminCache),
  pruneCatalog: () => apiClient('/admin/maintenance/prune', { method: 'POST' }).finally(clearAdminCache),
  getScannerDrafts: (status = 'draft') => cachedGet('/admin/scanner/drafts', { status }),

  // Content management
  getContent: (params = {}) => cachedGet('/admin/content', { ...params, summary: 'true' }),
  getContentOrganization: (params = {}) => cachedGet('/admin/content/organization', params),
  getContentById: (id) => apiClient(`/admin/content/${id}`),
  createContent: (data) => apiClient('/admin/content', {
    method: 'POST',
    body: JSON.stringify(data),
  }).finally(clearAdminCache),
  updateContent: (id, data) => apiClient(`/admin/content/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).finally(clearAdminCache),
  bulkUpdateContent: (ids, changes) => apiClient('/admin/content/bulk-update', {
    method: 'POST',
    body: JSON.stringify({ ids, changes }),
  }).finally(clearAdminCache),
  deleteContent: (id) => apiClient(`/admin/content/${id}`, { method: 'DELETE' }).finally(clearAdminCache),
  publishContent: (id) => apiClient(`/admin/content/${id}/publish`, { method: 'POST' }).finally(clearAdminCache),
  unpublishContent: (id) => apiClient(`/admin/content/${id}/unpublish`, { method: 'POST' }).finally(clearAdminCache),
  
  // Movies
  getMovies: (params = {}) => cachedGet('/admin/movies', { ...params, summary: 'true' }),
  
  // Series
  getSeries: (params = {}) => cachedGet('/admin/series', { ...params, summary: 'true' }),
  getDbHealth: () => cachedGet('/admin/db/health'),
  
  // Media uploads
  uploadPoster: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient('/admin/upload/poster', {
      method: 'POST',
      body: formData,
    });
  },
  uploadBanner: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient('/admin/upload/banner', {
      method: 'POST',
      body: formData,
    });
  },
  importTmdbMetadata: (tmdbId, type = 'movie') => apiClient('/admin/metadata/tmdb', {
    method: 'POST',
    body: JSON.stringify({ tmdbId, type }),
  }).finally(clearAdminCache),
};

export default adminService;
