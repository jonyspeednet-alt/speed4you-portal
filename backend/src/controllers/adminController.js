const {
  createItem,
  deleteItem,
  getItemById,
  getRecentItems,
  getScannerRuns,
  getStats,
  getLibraryOrganization,
  listItems,
  pruneCatalog,
  updateItem,
  vacuumDatabase,
} = require('../data/store');
const { getCurrentScanJob, getScannerHealth, listScannerRoots, startScanJob, stopScanJob } = require('../services/scanner');
const { fetchMetadataByTmdbId, fetchMetadataFromOmdb } = require('../services/metadata-enricher');
const { getMediaNormalizerStatus, startMediaNormalizer, stopMediaNormalizer } = require('../services/media-normalizer');
const { getDuplicateReviewReport, runDuplicateCleanup } = require('../services/duplicate-review');
const { AppError } = require('../utils/error');
const db = require('../config/database');
const { saveBufferAsset, saveDataUrlAsset } = require('../utils/assetHelper');

function pickMovieVideoUrlFromSeasons(seasons = []) {
  for (const season of seasons || []) {
    for (const episode of season?.episodes || []) {
      if (episode?.videoUrl) {
        return episode.videoUrl;
      }
    }
  }
  return '';
}

function sanitizeManualContentPayload(payload = {}, existingItem = null) {
  const nextType = String(payload.type || existingItem?.type || 'movie').toLowerCase();
  const nextPayload = { ...payload, type: nextType };

  if (nextType === 'movie') {
    const effectiveSeasons = Array.isArray(payload.seasons)
      ? payload.seasons
      : Array.isArray(existingItem?.seasons) ? existingItem.seasons : [];
    const fallbackVideoUrl = payload.videoUrl
      || existingItem?.videoUrl
      || pickMovieVideoUrlFromSeasons(effectiveSeasons);

    return {
      ...nextPayload,
      videoUrl: fallbackVideoUrl || '',
      seasons: [],
      seasonCount: 0,
      episodeCount: 0,
      collection: payload.collection || (existingItem?.collection === 'Series' ? 'Movies' : (existingItem?.collection || 'Movies')),
    };
  }

  const nextSeasons = Array.isArray(payload.seasons)
    ? payload.seasons
    : Array.isArray(existingItem?.seasons) ? existingItem.seasons : [];

  return {
    ...nextPayload,
    seasons: nextSeasons,
    seasonCount: nextSeasons.length,
    episodeCount: nextSeasons.reduce((sum, season) => sum + ((season?.episodes || []).length), 0),
    collection: payload.collection || existingItem?.collection || 'Series',
  };
}

function toSummaryItem(item) {
  const poster = item.poster || item.backdrop || item.thumbnail || '';
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    sourceType: item.sourceType,
    sourceRootId: item.sourceRootId || '',
    sourceRootLabel: item.sourceRootLabel || '',
    sourcePath: item.sourcePath || '',
    language: item.language || '',
    category: item.category || '',
    collection: item.collection || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    year: item.year || null,
    metadataStatus: item.metadataStatus || 'pending',
    metadataConfidence: Number(item.metadataConfidence || 0),
    metadataUpdatedAt: item.metadataUpdatedAt || '',
    duplicateCount: Number(item.duplicateCount || 0),
    duplicateCandidates: Array.isArray(item.duplicateCandidates) ? item.duplicateCandidates : [],
    featured: Boolean(item.featured),
    featuredOrder: Number(item.featuredOrder || 0),
    trendingScore: Number(item.trendingScore || 0),
    adminNotes: item.adminNotes || '',
    poster,
    backdrop: item.backdrop || item.poster || '',
    videoUrl: item.videoUrl || '',
    updatedAt: item.updatedAt || '',
  };
}

function withSummaryResult(result, summaryRequested) {
  if (!summaryRequested) return result;
  return {
    ...result,
    items: (result.items || []).map(toSummaryItem),
  };
}

exports.getDashboard = async (req, res) => {
  const stats = await getStats();
  const recentContent = await getRecentItems(8);
  const { items: scannerDrafts } = await listItems({ source: 'scanner', status: 'draft' }, 0, 12);

  res.json({
    stats,
    recentContent,
    scannerDrafts,
    scannerRoots: listScannerRoots(),
  });
};

exports.getStats = async (req, res) => {
  res.json(await getStats());
};

exports.getContentList = async (req, res) => {
  const { status, type, source, sourceRootId, language, category, collection, tag, search, sort, page, limit, summary, duplicatesOnly } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const result = await listItems({
    status,
    type,
    source,
    sourceRootId,
    language,
    category,
    collection,
    tag,
    search,
    duplicatesOnly: String(duplicatesOnly) === 'true',
  }, offset, limitNum, sort || 'latest', false);
  res.json(withSummaryResult(result, String(summary) === 'true'));
};

exports.getMovies = async (req, res) => {
  req.query.type = 'movie';
  return exports.getContentList(req, res);
};

exports.getSeries = async (req, res) => {
  req.query.type = 'series';
  return exports.getContentList(req, res);
};

exports.getLibraryOrganization = async (req, res) => {
  const { status, type, source, sourceRootId, language, category, collection, tag, search } = req.query;
  res.json(await getLibraryOrganization({ status, type, source, sourceRootId, language, category, collection, tag, search }));
};

exports.getContentById = async (req, res) => {
  const item = await getItemById(req.params.id);
  if (!item) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return res.json(item);
};

exports.createContent = async (req, res) => {
  const { title, type = 'movie' } = req.body;
  if (!title) throw new AppError('Title is required', 400, 'BAD_REQUEST');

  const sanitizedPayload = sanitizeManualContentPayload(req.body);
  const item = await createItem({
    ...sanitizedPayload,
    slug: req.body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    type,
    sourceType: 'manual',
  });
  return res.status(201).json(item);
};

exports.updateContent = async (req, res) => {
  const current = await getItemById(req.params.id);
  if (!current) throw new AppError('Content not found', 404, 'NOT_FOUND');
  const sanitizedPayload = sanitizeManualContentPayload(req.body, current);
  const item = await updateItem(req.params.id, sanitizedPayload);
  if (!item) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return res.json(item);
};

exports.bulkUpdateContent = async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const changes = req.body?.changes || {};
  if (!ids.length) throw new AppError('At least one content id is required.', 400, 'BAD_REQUEST');

  const updated = (await Promise.all(ids.map((id) => updateItem(id, changes)))).filter(Boolean);
  return res.json({ updatedCount: updated.length, items: updated });
};

exports.deleteContent = async (req, res) => {
  const removed = await deleteItem(req.params.id);
  if (!removed) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return res.status(204).send();
};

exports.publishContent = async (req, res) => {
  const item = await updateItem(req.params.id, { status: 'published' });
  if (!item) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return res.json(item);
};

exports.unpublishContent = async (req, res) => {
  const item = await updateItem(req.params.id, { status: 'draft' });
  if (!item) throw new AppError('Content not found', 404, 'NOT_FOUND');
  return res.json(item);
};

exports.pruneCatalog = async (req, res) => {
  res.json(await pruneCatalog());
};

exports.vacuumDatabase = async (req, res) => {
  res.json(await vacuumDatabase());
};

exports.uploadPoster = (req, res, next) => {
  try {
    const assetUrl = req.file ? saveBufferAsset(req.file, 'posters') : saveDataUrlAsset(req.body?.dataUrl, 'posters');
    res.status(201).json({ url: assetUrl });
  } catch (error) {
    next(new AppError(error.message || 'Poster upload failed.', 400, 'BAD_REQUEST'));
  }
};

exports.uploadBanner = (req, res, next) => {
  try {
    const assetUrl = req.file ? saveBufferAsset(req.file, 'banners') : saveDataUrlAsset(req.body?.dataUrl, 'banners');
    res.status(201).json({ url: assetUrl });
  } catch (error) {
    next(new AppError(error.message || 'Banner upload failed.', 400, 'BAD_REQUEST'));
  }
};

exports.getScannerRoots = (req, res) => {
  res.json({ items: listScannerRoots() });
};

exports.getScannerDrafts = async (req, res) => {
  const latestOnly = req.query.latestOnly !== 'false';
  const latestRunId = latestOnly ? getScannerRuns(1)[0]?.id : '';
  const result = await listItems({
    source: 'scanner',
    status: req.query.status || 'draft',
    ...(latestRunId ? { scanRunId: latestRunId } : {}),
  }, 0, null);
  res.json(result);
};

exports.getScannerLogs = (req, res) => {
  const limit = Number(req.query.limit || 10);
  const runs = getScannerRuns(limit);
  res.json({ items: runs, total: runs.length });
};

exports.getScannerHealth = async (req, res) => {
  res.json(await getScannerHealth());
};

exports.getCurrentScannerJob = (req, res) => {
  res.json({ job: getCurrentScanJob() });
};

exports.runScanner = (req, res) => {
  const rootIds = Array.isArray(req.body?.rootIds) ? req.body.rootIds : [];
  const job = startScanJob(rootIds);
  res.status(202).json({ job });
};

exports.stopScanner = (req, res) => {
  const job = stopScanJob();
  res.status(202).json({ job });
};

exports.getDbHealth = async (req, res) => {
  const [sizeResult] = await Promise.all([
    db.query('SELECT pg_size_pretty(pg_database_size(current_database())) AS size_pretty'),
  ]);

  res.json({
    checkedAt: new Date().toISOString(),
    database: process.env.DB_NAME || 'isp_entertainment',
    pool: {
      total: db.pool.totalCount,
      idle: db.pool.idleCount,
      waiting: db.pool.waitingCount,
    },
    databaseSize: sizeResult.rows[0]?.size_pretty || 'unknown',
  });
};

exports.getMediaNormalizerStatus = async (req, res) => {
  const status = await getMediaNormalizerStatus();
  // Strip internal lock (contains PID) before sending to client
  const { lock: _lock, ...safeStatus } = status;
  res.json(safeStatus);
};

exports.startMediaNormalizer = async (req, res) => {
  res.status(202).json(await startMediaNormalizer());
};

exports.stopMediaNormalizer = async (req, res) => {
  res.status(202).json(await stopMediaNormalizer());
};

exports.getDuplicatesReport = (req, res) => {
  res.json(getDuplicateReviewReport());
};

exports.runDuplicatesCleanup = (req, res) => {
  res.status(202).json(runDuplicateCleanup());
};

exports.fetchTmdbMetadata = async (req, res) => {
  const inputId = String(req.body?.tmdbId || '').trim();
  const mediaType = req.body?.type || 'movie';
  if (!inputId) throw new AppError('Valid TMDb or IMDb ID is required.', 400, 'BAD_REQUEST');

  let metadata;
  if (inputId.toLowerCase().startsWith('tt')) {
    metadata = await fetchMetadataFromOmdb(inputId);
  } else {
    const tmdbId = Number(inputId);
    if (isNaN(tmdbId)) {
      throw new AppError('Invalid TMDb ID format.', 400, 'BAD_REQUEST');
    }
    metadata = await fetchMetadataByTmdbId(tmdbId, mediaType);
  }
  return res.json({ metadata });
};
