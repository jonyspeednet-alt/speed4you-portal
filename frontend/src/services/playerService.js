import apiClient from './apiClient';

export const playerService = {
  getStream: (contentType, contentId, params = {}) => apiClient(`/player/${contentType}/${contentId}?${new URLSearchParams(params)}`),
  getSubtitles: (contentType, contentId) => apiClient(`/player/${contentType}/${contentId}/subtitles`),
  reportIssue: (contentType, contentId, issue) => apiClient('/player/report', {
    method: 'POST',
    body: JSON.stringify({ contentType, contentId, issue }),
  }),
};

export default playerService;
