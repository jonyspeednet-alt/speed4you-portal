const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const NOISE_PATTERNS = [
  /\b(480p|720p|1080p|2160p|4k)\b/gi,
  /\b(web[- ]?dl|webrip|bluray|brrip|hdrip|dvdrip|x264|x265|h\.?264|h\.?265|hevc)\b/gi,
  /\b(dual audio|multi audio|english|hindi|bangla|bengali|japanese|korean|french|spanish|dubbed|subbed)\b/gi,
  /\b(complete|full)\s+(series|season)\b/gi,
  /\bseason\s*\d{1,2}\b/gi,
  /\bs\d{1,2}\s*[-_. ]*e\d{1,3}\b/gi,
  /\bs\d{1,2}\b/gi,
  /\be\d{1,3}\b/gi,
  /\b\d{1,2}x\d{1,3}\b/gi,
  /\bepisode\s*\d{1,3}\b/gi,
  /\b(normalizing|pre-normalize)\b/gi,
  /\[[^\]]+\]/g,
  /\{[^}]+\}/g,
];

function hasTmdbKey() {
  return Boolean(process.env.TMDB_API_KEY);
}

function hasOmdbKey() {
  return Boolean(process.env.OMDB_API_KEY);
}

function cleanSearchTitle(value) {
  let normalized = String(value || '').replace(/\.[^.]+$/, '');
  normalized = normalized.replace(/[._]/g, ' ');
  normalized = normalized
    .replace(/\bnormalizing\s+\d+\s+[a-f0-9]{6,}\b/gi, ' ')
    .replace(/\bpre[- ]normalize\s+\d+\b/gi, ' ')
    .replace(/\b[a-f0-9]{7,}\b/gi, ' ');

  for (const pattern of NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, ' ');
  }

  return normalized
    .replace(/\((19|20)\d{2}\)/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s*[-:]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferOriginalLanguage(item) {
  const categoryText = `${item.category || ''} ${item.sourceRootLabel || ''}`.toLowerCase();
  const languageText = String(item.language || '').toLowerCase();

  if (languageText.includes('bengali') || categoryText.includes('bangla')) return 'bn';
  if (languageText.includes('hindi')) return 'hi';
  if (languageText.includes('japanese') || categoryText.includes('animation')) return 'ja';
  if (languageText.includes('korean')) return 'ko';
  return 'en';
}

function scoreCandidate(candidate, item) {
  const searchTitle = cleanSearchTitle(item.title).toLowerCase();
  const candidateTitle = String(candidate.title || candidate.name || '').toLowerCase();
  const candidateOriginalTitle = String(candidate.original_title || candidate.original_name || '').toLowerCase();
  const targetYear = Number(item.year) || null;
  const candidateYear = Number((candidate.release_date || candidate.first_air_date || '').slice(0, 4)) || null;
  const targetLanguage = inferOriginalLanguage(item);
  let score = 0;

  if (candidateTitle === searchTitle || candidateOriginalTitle === searchTitle) {
    score += 55;
  } else if (candidateTitle.includes(searchTitle) || searchTitle.includes(candidateTitle)) {
    score += 35;
  }

  if (targetYear && candidateYear) {
    const delta = Math.abs(targetYear - candidateYear);
    if (delta === 0) score += 25;
    else if (delta === 1) score += 15;
    else if (delta === 2) score += 6;
  }

  if (candidate.original_language === targetLanguage) score += 12;
  score += Math.min(Number(candidate.popularity || 0) / 10, 8);
  return Math.round(score);
}

async function tmdbFetchJson(pathname, params = {}) {
  const url = new URL(`${TMDB_API_BASE_URL}${pathname}`);
  url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  url.searchParams.set('include_adult', 'false');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDb request failed with status ${response.status}`);
  }

  return response.json();
}

function buildImageUrl(path, size = 'w780') {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : '';
}

async function fetchTmdbDetails(resultId, mediaType) {
  const appendToResponse = mediaType === 'tv' ? 'external_ids,content_ratings' : 'external_ids';
  const payload = await tmdbFetchJson(`/${mediaType}/${resultId}`, {
    append_to_response: appendToResponse,
  });

  return {
    tmdbId: payload.id || null,
    title: payload.title || payload.name || '',
    imdbId: payload.external_ids?.imdb_id || '',
    originalTitle: payload.original_title || payload.original_name || '',
    overview: payload.overview || '',
    poster: buildImageUrl(payload.poster_path, 'w500'),
    backdrop: buildImageUrl(payload.backdrop_path, 'w1280'),
    genres: Array.isArray(payload.genres) ? payload.genres.map((entry) => entry.name).filter(Boolean) : [],
    genre: Array.isArray(payload.genres) ? payload.genres.map((entry) => entry.name).filter(Boolean).join(', ') : '',
    rating: payload.vote_average ? Number(payload.vote_average.toFixed(1)) : null,
    runtime: payload.runtime || null,
    originalLanguage: payload.original_language || '',
    year: Number((payload.release_date || payload.first_air_date || '').slice(0, 4)) || null,
    numberOfSeasons: Number(payload.number_of_seasons || 0),
  };
}

async function fetchTvSeasonEpisodes(tmdbId, seasonNumber) {
  const payload = await tmdbFetchJson(`/tv/${tmdbId}/season/${seasonNumber}`);
  const episodes = Array.isArray(payload.episodes) ? payload.episodes : [];

  return episodes.map((episode) => ({
    id: episode.id || `${tmdbId}-${seasonNumber}-${episode.episode_number}`,
    number: Number(episode.episode_number || 0),
    title: episode.name || '',
    description: episode.overview || '',
    runtime: Array.isArray(episode.runtime) ? episode.runtime[0] || null : episode.runtime || null,
    airDate: episode.air_date || '',
    still: buildImageUrl(episode.still_path, 'w780'),
  }));
}

async function fetchTvSeasons(tmdbId, seasonCount) {
  if (!Number.isFinite(seasonCount) || seasonCount <= 0) {
    return [];
  }

  const seasons = [];
  for (let seasonNumber = 1; seasonNumber <= seasonCount; seasonNumber += 1) {
    const episodes = await fetchTvSeasonEpisodes(tmdbId, seasonNumber);
    if (!episodes.length) {
      continue;
    }

    seasons.push({
      id: `${tmdbId}-season-${seasonNumber}`,
      number: seasonNumber,
      title: `Season ${seasonNumber}`,
      episodes,
    });
  }

  return seasons;
}

async function fetchMetadataFromOmdb(imdbId) {
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('i', imdbId);
  url.searchParams.set('apikey', process.env.OMDB_API_KEY);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OMDB request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data.Response === 'False') {
    throw new Error(`OMDB error: ${data.Error}`);
  }

  const isSeries = data.Type === 'series';
  return {
    type: isSeries ? 'series' : 'movie',
    title: data.Title || '',
    description: data.Plot !== 'N/A' ? data.Plot : '',
    year: parseInt(data.Year, 10) || null,
    genre: data.Genre !== 'N/A' ? data.Genre : '',
    genres: data.Genre !== 'N/A' ? data.Genre.split(',').map((g) => g.trim()) : [],
    poster: data.Poster !== 'N/A' ? data.Poster : '',
    backdrop: data.Poster !== 'N/A' ? data.Poster : '',
    tmdbId: null,
    imdbId: data.imdbID || imdbId,
    originalTitle: data.Title || '',
    originalLanguage: data.Language && data.Language !== 'N/A' ? data.Language.split(',')[0].trim() : 'en',
    rating: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
    runtime: data.Runtime && data.Runtime !== 'N/A' ? parseInt(data.Runtime, 10) : null,
    seasons: [], // OMDB doesn't provide rich episode lists in the base call
    metadataStatus: 'matched',
    metadataProvider: 'omdb',
    metadataConfidence: 100,
    metadataUpdatedAt: new Date().toISOString(),
    metadataError: '',
    parsedTitle: cleanSearchTitle(data.Title),
  };
}

async function fetchMetadataByTmdbId(tmdbId, mediaType = 'movie') {
  if (!hasTmdbKey()) {
    throw new Error('TMDB_API_KEY is not configured.');
  }

  const normalizedType = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie';
  const details = await fetchTmdbDetails(tmdbId, normalizedType);
  const seasons = normalizedType === 'tv'
    ? await fetchTvSeasons(details.tmdbId, details.numberOfSeasons)
    : [];

  return {
    type: normalizedType === 'tv' ? 'series' : 'movie',
    title: details.title,
    description: details.overview,
    year: details.year,
    genre: details.genre,
    genres: details.genres,
    poster: details.poster,
    backdrop: details.backdrop,
    tmdbId: details.tmdbId,
    imdbId: details.imdbId,
    originalTitle: details.originalTitle,
    originalLanguage: details.originalLanguage,
    rating: details.rating,
    runtime: details.runtime,
    seasons,
    metadataStatus: 'matched',
    metadataProvider: 'tmdb',
    metadataConfidence: 100,
    metadataUpdatedAt: new Date().toISOString(),
    metadataError: '',
    parsedTitle: cleanSearchTitle(details.title),
  };
}

async function enrichItemWithMetadata(item) {
  const parsedTitle = cleanSearchTitle(item.title);

  // If OMDB key is available and IMDb ID is provided, try OMDB first for items not found on TMDb
  if (item.imdbId && hasOmdbKey()) {
    try {
      const omdbData = await fetchMetadataFromOmdb(item.imdbId);
      return {
        ...item,
        description: item.description || omdbData.description,
        poster: item.poster || omdbData.poster,
        backdrop: item.backdrop || omdbData.backdrop,
        genre: item.genre || omdbData.genre,
        genres: Array.isArray(item.genres) && item.genres.length ? item.genres : omdbData.genres,
        rating: item.rating || omdbData.rating,
        runtime: item.runtime || omdbData.runtime,
        imdbId: omdbData.imdbId,
        originalTitle: omdbData.originalTitle,
        originalLanguage: omdbData.originalLanguage,
        metadataStatus: 'matched',
        metadataProvider: 'omdb',
        metadataConfidence: 100,
        metadataUpdatedAt: new Date().toISOString(),
        metadataError: '',
        parsedTitle,
      };
    } catch (omdbError) {
      if (!hasTmdbKey()) {
        return {
          ...item,
          metadataStatus: 'failed',
          metadataProvider: 'omdb',
          metadataConfidence: 0,
          metadataUpdatedAt: new Date().toISOString(),
          metadataError: omdbError.message || 'OMDB enrichment failed.',
          parsedTitle,
        };
      }
    }
  }

  if (!hasTmdbKey()) {
    return {
      ...item,
      metadataStatus: 'skipped',
      metadataProvider: '',
      metadataConfidence: 0,
      metadataUpdatedAt: new Date().toISOString(),
      metadataError: 'TMDB_API_KEY is not configured.',
      parsedTitle,
    };
  }

  if (!parsedTitle) {
    return {
      ...item,
      metadataStatus: 'skipped',
      metadataProvider: '',
      metadataConfidence: 0,
      metadataUpdatedAt: new Date().toISOString(),
      metadataError: 'Unable to parse a searchable title from scanner input.',
      parsedTitle,
    };
  }

  try {
    const mediaType = item.type === 'series' ? 'tv' : 'movie';
    const response = await tmdbFetchJson(`/search/${mediaType}`, {
      query: parsedTitle,
      year: item.type === 'movie' ? item.year : undefined,
      first_air_date_year: item.type === 'series' ? item.year : undefined,
    });

    const results = Array.isArray(response.results) ? response.results : [];
    if (!results.length) {
      return {
        ...item,
        metadataStatus: 'not_found',
        metadataProvider: 'tmdb',
        metadataConfidence: 0,
        metadataUpdatedAt: new Date().toISOString(),
        metadataError: 'No TMDb match found.',
        parsedTitle,
      };
    }

    const rankedResults = results
      .map((candidate) => ({ candidate, score: scoreCandidate(candidate, item) }))
      .sort((left, right) => right.score - left.score);
    const bestMatch = rankedResults[0];
    const details = await fetchTmdbDetails(bestMatch.candidate.id, mediaType);
    const seasons = mediaType === 'tv'
      ? await fetchTvSeasons(details.tmdbId, details.numberOfSeasons)
      : [];
    const confidence = Math.max(0, Math.min(bestMatch.score, 100));

    return {
      ...item,
      description: item.description || details.overview,
      poster: item.poster || details.poster,
      backdrop: item.backdrop || details.backdrop || item.poster || details.poster,
      genre: item.genre || details.genre,
      genres: Array.isArray(item.genres) && item.genres.length ? item.genres : details.genres,
      rating: item.rating || details.rating,
      runtime: item.runtime || details.runtime,
      seasons: item.type === 'series' && seasons.length ? mergeEpisodeMetadata(item.seasons || [], seasons) : item.seasons,
      tmdbId: details.tmdbId,
      imdbId: details.imdbId,
      originalTitle: details.originalTitle,
      originalLanguage: details.originalLanguage,
      metadataStatus: confidence >= 70 ? 'matched' : 'needs_review',
      metadataProvider: 'tmdb',
      metadataConfidence: confidence,
      metadataUpdatedAt: new Date().toISOString(),
      metadataError: '',
      parsedTitle,
    };
  } catch (error) {
    return {
      ...item,
      metadataStatus: 'failed',
      metadataProvider: 'tmdb',
      metadataConfidence: 0,
      metadataUpdatedAt: new Date().toISOString(),
      metadataError: error.message || 'Metadata enrichment failed.',
      parsedTitle,
    };
  }
}

function mergeEpisodeMetadata(existingSeasons = [], tmdbSeasons = []) {
  return (existingSeasons || []).map((season, seasonIndex) => {
    const seasonNumber = Number(season.number || season.id || seasonIndex + 1);
    const tmdbSeason = tmdbSeasons.find((candidate) => Number(candidate.number) === seasonNumber);

    if (!tmdbSeason) {
      return season;
    }

    return {
      ...season,
      title: season.title || tmdbSeason.title || `Season ${seasonNumber}`,
      episodes: (season.episodes || []).map((episode, episodeIndex) => {
        const episodeNumber = Number(episode.number || episode.id || episodeIndex + 1);
        const tmdbEpisode = (tmdbSeason.episodes || []).find((candidate) => Number(candidate.number) === episodeNumber);

        if (!tmdbEpisode) {
          return episode;
        }

        return {
          ...episode,
          title: tmdbEpisode.title || episode.title,
          description: tmdbEpisode.description || episode.description,
          runtime: episode.runtime || tmdbEpisode.runtime || null,
          runtimeMinutes: episode.runtimeMinutes || tmdbEpisode.runtime || null,
          airDate: episode.airDate || tmdbEpisode.airDate || '',
          still: episode.still || tmdbEpisode.still || '',
        };
      }),
    };
  });
}

module.exports = {
  cleanSearchTitle,
  enrichItemWithMetadata,
  fetchMetadataByTmdbId,
  fetchMetadataFromOmdb,
  hasTmdbKey,
  hasOmdbKey,
};
