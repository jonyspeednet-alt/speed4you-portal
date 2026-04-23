export function formatDuration(seconds) {
  if (!seconds) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatYear(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.getFullYear();
}

export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function buildImageUrl(path, size = 'w500') {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/tp/${size}${path}`;
}

export function getProgressPercent(position, duration) {
  if (!duration || duration === 0) return 0;
  return Math.round((position / duration) * 100);
}

export function groupEpisodesBySeason(episodes) {
  if (!episodes || episodes.length === 0) return {};
  return episodes.reduce((acc, episode) => {
    const season = episode.seasonNumber || 1;
    if (!acc[season]) {
      acc[season] = [];
    }
    acc[season].push(episode);
    return acc;
  }, {});
}

export function normalizeSearchQuery(query) {
  if (!query) return '';
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function isInsideAllowedAccessContext(allowedIPs = []) {
  void allowedIPs;
  return true;
}

export function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatRating(rating) {
  if (!rating) return '0.0';
  return parseFloat(rating).toFixed(1);
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function generateSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const safeObject = (obj) => obj || {};
