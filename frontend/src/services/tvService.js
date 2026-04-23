import apiClient from './apiClient';

export const tvService = {
  getChannels: () => apiClient('/tv/channels'),
  getStream: (streamId) => apiClient(`/tv/stream/${streamId}`),
};

export default tvService;
