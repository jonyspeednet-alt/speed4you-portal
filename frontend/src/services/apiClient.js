const API_BASE = (import.meta.env.VITE_API_URL || '/portal-api').replace(/\/$/, '');

class ApiError extends Error {
  constructor(message, { status = 500, code = 'REQUEST_FAILED', details = null, requestId = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function parseApiErrorPayload(rawText, status) {
  if (!rawText) {
    return {
      message: `Request failed (${status})`,
      code: 'REQUEST_FAILED',
      details: null,
      requestId: '',
    };
  }

  try {
    const parsed = JSON.parse(rawText);
    if (parsed?.error && typeof parsed.error === 'object') {
      return {
        message: parsed.error.message || `Request failed (${status})`,
        code: parsed.error.code || 'REQUEST_FAILED',
        details: parsed.error.details || null,
        requestId: parsed.requestId || '',
      };
    }

    return {
      message: parsed?.error || parsed?.message || `Request failed (${status})`,
      code: 'REQUEST_FAILED',
      details: null,
      requestId: '',
    };
  } catch {
    return {
      message: rawText || `Request failed (${status})`,
      code: 'REQUEST_FAILED',
      details: null,
      requestId: '',
    };
  }
}

function clearStoredSession() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const loginUrl = new URL('/login', window.location.origin);
  if (nextPath && nextPath !== '/login') {
    loginUrl.searchParams.set('next', nextPath);
  }
  window.location.replace(loginUrl.toString());
}

async function apiClient(endpoint, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '';
  const method = (options.method || 'GET').toUpperCase();
  const endpointUrl = new URL(`${API_BASE}/api${endpoint}`, window.location.origin);

  if (method === 'GET' && options.bustCache !== false) {
    endpointUrl.searchParams.set('_ts', String(Date.now()));
  }

  const config = {
    cache: options.cache || 'no-store',
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && !(options.headers || {}).Authorization ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(endpointUrl.toString(), config);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const parsed = parseApiErrorPayload(errorText, response.status);
    if (response.status === 401) {
      clearStoredSession();
      if (!String(endpoint || '').startsWith('/auth/')) {
        redirectToLogin();
      }
    }
    throw new ApiError(parsed.message, {
      status: response.status,
      code: parsed.code,
      details: parsed.details,
      requestId: parsed.requestId,
    });
  }

  if (response.status === 204) {
    return null;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return text ? { data: text } : null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const contentService = {
  getFeatured: () => apiClient('/content/featured'),
  getLatest: (limit = 10) => apiClient(`/content/latest?${new URLSearchParams({ limit })}`),
  getPopular: (limit = 10) => apiClient(`/content/popular?${new URLSearchParams({ limit })}`),
  browse: (params) => apiClient(`/content/browse?${new URLSearchParams(params)}`),
  getHomepage: (limit = 30) => apiClient(`/content/homepage?${new URLSearchParams({ limit })}`, {
    cache: 'default',
    bustCache: false,
  }),
};

export const moviesService = {
  getAll: (params) => apiClient(`/movies?${new URLSearchParams(params)}`),
  getById: (id) => apiClient(`/movies/${id}`),
};

export const seriesService = {
  getAll: (params) => apiClient(`/series?${new URLSearchParams(params)}`),
  getById: (id) => apiClient(`/series/${id}`),
  getSeasons: (id) => apiClient(`/series/${id}/seasons`),
  getEpisodes: (id, seasonId) => apiClient(`/series/${id}/seasons/${seasonId}/episodes`),
};

export const searchService = {
  search: (query) => apiClient(`/search?q=${encodeURIComponent(query)}`),
};

export const watchlistService = {
  get: () => apiClient('/watchlist', { headers: getAuthHeader() }),
  add: (contentType, contentId) => apiClient('/watchlist', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId }),
    headers: getAuthHeader(),
  }),
  remove: (id) => apiClient(`/watchlist/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  }),
};

export const progressService = {
  get: () => apiClient('/progress', { headers: getAuthHeader() }),
  update: (contentType, contentId, position, duration) => apiClient('/progress', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId, position, duration }),
    headers: getAuthHeader(),
  }),
  getFor: (contentType, contentId) => apiClient(`/progress/${contentType}/${contentId}`, {
    headers: getAuthHeader(),
  }),
};

export const playerService = {
  getStream: (contentType, id, params = {}) => apiClient(`/player/${contentType}/${id}?${new URLSearchParams(params)}`, {
    headers: getAuthHeader(),
  }),
  prepareStream: (contentType, id, params = {}) => apiClient(`/player/prepare/${contentType}/${id}?${new URLSearchParams(params)}`, {
    headers: getAuthHeader(),
  }),
};

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default apiClient;
export { ApiError };
