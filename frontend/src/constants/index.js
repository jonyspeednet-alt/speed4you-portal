export const ROUTES = {
  HOME: '/',
  BROWSE: '/browse',
  MOVIES: '/movies',
  SERIES: '/series',
  SEARCH: '/search',
  WATCHLIST: '/watchlist',
  ACCESS: '/access',
  LOGIN: '/login',
  ADMIN: '/admin',
  ADMIN_CONTENT: '/admin/content',
  ADMIN_MOVIES: '/admin/movies',
  ADMIN_SERIES: '/admin/series',
};

export const CONTENT_TYPES = {
  MOVIE: 'movie',
  SERIES: 'series',
};

export const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'War',
  'Western',
];

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'bn', name: 'Bengali' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
];

export const QUALITY_OPTIONS = [
  { value: 'sd', label: 'SD' },
  { value: 'hd', label: 'HD' },
  { value: 'fhd', label: 'Full HD' },
  { value: '4k', label: '4K' },
];

export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
  MAINTENANCE: 'maintenance',
  BROKEN: 'broken',
};

export const NAV_ITEMS = [
  { path: ROUTES.HOME, label: 'Home' },
  { path: ROUTES.BROWSE, label: 'Browse' },
  { path: ROUTES.MOVIES, label: 'Movies' },
  { path: ROUTES.SERIES, label: 'Series' },
  { path: ROUTES.WATCHLIST, label: 'My List' },
];

export const ADMIN_NAV_ITEMS = [
  { path: ROUTES.ADMIN, label: 'Dashboard' },
  { path: ROUTES.ADMIN_CONTENT, label: 'Content' },
  { path: ROUTES.ADMIN_MOVIES, label: 'Movies' },
  { path: ROUTES.ADMIN_SERIES, label: 'Series' },
];

export const IMAGE_RATIOS = {
  POSTER: '2/3',
  LANDSCAPE: '16/9',
  HERO: '21/9',
};

export const API_ENDPOINTS = {
  CONTENT: '/api/content',
  MOVIES: '/api/movies',
  SERIES: '/api/series',
  SEARCH: '/api/search',
  WATCHLIST: '/api/watchlist',
  PROGRESS: '/api/progress',
  PLAYER: '/api/player',
  AUTH: '/api/auth',
};
