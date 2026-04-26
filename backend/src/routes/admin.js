const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');
const requireAdminAuth = require('../middleware/require-admin-auth');
const {
  createItem,
  deleteItem,
  getItemById,
  getRecentItems,
  getScannerRuns,
  getStats,
  getLibraryOrganization,
  listItems,
  loadScannerRoots,
  pruneCatalog,
  updateItem,
} = require('../data/store');
const { getCurrentScanJob, getScannerHealth, startScanJob, stopScanJob } = require('../services/scanner');
const { fetchMetadataByTmdbId } = require('../services/metadata-enricher');
const {
  getMediaNormalizerStatus,
  startMediaNormalizer,
  stopMediaNormalizer,
} = require('../services/media-normalizer');
const {
  getDuplicateReviewReport,
  runDuplicateCleanup,
} = require('../services/duplicate-review');

const router = express.Router();
router.use(requireAdminAuth);
const MAX_UPLOAD_BYTES = Number(process.env.ADMIN_UPLOAD_MAX_BYTES || 1024 * 1024);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function resolveUploadDirectory() {
  const configuredPath = process.env.ADMIN_UPLOAD_DIR;
  if (configuredPath) {
    return configuredPath;
  }

  const productionPath = '/var/www/html/portal/uploads';
  if (fs.existsSync('/var/www/html/portal') || process.platform !== 'win32') {
    return productionPath;
  }

  return path.resolve(__dirname, '../../../frontend/public/uploads');
}

const ALLOWED_UPLOAD_FOLDERS = new Set(['images', 'posters', 'backdrops', 'avatars']);

function sanitizeUploadFolder(folder) {
  const safe = String(folder || 'images').replace(/[^a-z0-9_-]/gi, '');
  return ALLOWED_UPLOAD_FOLDERS.has(safe) ? safe : 'images';
}

function saveDataUrlAsset(dataUrl, folder = 'images') {
  folder = sanitizeUploadFolder(folder);
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image payload.');
  }

  const mimeType = match[1].toLowerCase();
  const extensionMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  const extension = extensionMap[mimeType];
  if (!extension) {
    throw new Error('Unsupported image type.');
  }
  const base64Payload = String(match[2] || '');
  const payloadBytes = Buffer.byteLength(base64Payload, 'base64');
  if (!Number.isFinite(payloadBytes) || payloadBytes <= 0) {
    throw new Error('Invalid image payload.');
  }
  if (payloadBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large. Max size is ${MAX_UPLOAD_BYTES} bytes.`);
  }

  const uploadRoot = resolveUploadDirectory();
  const targetDir = path.join(uploadRoot, folder);
  fs.mkdirSync(targetDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
  const absolutePath = path.join(targetDir, filename);
  fs.writeFileSync(absolutePath, Buffer.from(base64Payload, 'base64'));

  return `/portal/uploads/${folder}/${filename}`;
}

function saveBufferAsset(file, folder = 'images') {
  folder = sanitizeUploadFolder(folder);
  const mimeType = String(file?.mimetype || '').toLowerCase();
  const extensionMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  const extension = extensionMap[mimeType];
  if (!extension) {
    throw new Error('Unsupported image type.');
  }

  const size = Number(file?.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Invalid image payload.');
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large. Max size is ${MAX_UPLOAD_BYTES} bytes.`);
  }

  const uploadRoot = resolveUploadDirectory();
  const targetDir = path.join(uploadRoot, folder);
  fs.mkdirSync(targetDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
  const absolutePath = path.join(targetDir, filename);
  fs.writeFileSync(absolutePath, file.buffer);

  return `/portal/uploads/${folder}/${filename}`;
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
  if (!summaryRequested) {
    return result;
  }

  return {
    ...result,
    items: (result.items || []).map(toSummaryItem),
  };
}

router.get('/dashboard', asyncRoute(async (req, res) => {
  const stats = await getStats();
  const recentContent = await getRecentItems(8);
  const { items: scannerDrafts } = await listItems({ source: 'scanner', status: 'draft' }, 0, 12);

  res.json({
    stats,
    recentContent,
    scannerDrafts,
    scannerRoots: loadScannerRoots(),
  });
}));

router.get('/stats', asyncRoute(async (req, res) => {
  res.json(await getStats());
}));

router.get('/content', asyncRoute(async (req, res) => {
  const { status, type, source, sourceRootId, language, category, collection, tag, search, sort, page, limit, summary, duplicatesOnly } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  // Pass includeDuplicates=false — duplicateCount/duplicateCandidates are already
  // stored in each item's payload, so re-computing them for every page list adds
  // an expensive extra query with no benefit for the admin listing view.
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
}));

router.get('/content/organization', asyncRoute(async (req, res) => {
  const { status, type, source, sourceRootId, language, category, collection, tag, search } = req.query;
  res.json(await getLibraryOrganization({ status, type, source, sourceRootId, language, category, collection, tag, search }));
}));

router.get('/content/:id', asyncRoute(async (req, res) => {
  const item = await getItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }
  return res.json(item);
}));

router.post('/content', asyncRoute(async (req, res) => {
  const { title, type = 'movie' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const item = await createItem({
    ...req.body,
    slug: req.body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    type,
    sourceType: 'manual',
  });

  return res.status(201).json(item);
}));

router.put('/content/:id', asyncRoute(async (req, res) => {
  const item = await updateItem(req.params.id, req.body);
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }
  return res.json(item);
}));

router.post('/content/bulk-update', asyncRoute(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const changes = req.body?.changes || {};

  if (!ids.length) {
    return res.status(400).json({ error: 'At least one content id is required.' });
  }

  const updated = (await Promise.all(ids.map((id) => updateItem(id, changes)))).filter(Boolean);

  return res.json({
    updatedCount: updated.length,
    items: updated,
  });
}));

router.post('/maintenance/prune', asyncRoute(async (req, res) => {
  res.json(await pruneCatalog());
}));

router.delete('/content/:id', asyncRoute(async (req, res) => {
  const removed = await deleteItem(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Content not found' });
  }
  return res.status(204).send();
}));

router.post('/content/:id/publish', asyncRoute(async (req, res) => {
  const item = await updateItem(req.params.id, { status: 'published' });
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }
  return res.json(item);
}));

router.post('/content/:id/unpublish', asyncRoute(async (req, res) => {
  const item = await updateItem(req.params.id, { status: 'draft' });
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }
  return res.json(item);
}));

router.get('/movies', asyncRoute(async (req, res) => {
  const { status, source, sourceRootId, language, category, collection, tag, search, page, limit, summary, duplicatesOnly } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const result = await listItems({
    type: 'movie',
    status,
    source,
    sourceRootId,
    language,
    category,
    collection,
    tag,
    search,
    duplicatesOnly: String(duplicatesOnly) === 'true',
  }, offset, limitNum);
  res.json(withSummaryResult(result, String(summary) === 'true'));
}));

router.get('/series', asyncRoute(async (req, res) => {
  const { status, source, sourceRootId, language, category, collection, tag, search, page, limit, summary, duplicatesOnly } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const result = await listItems({
    type: 'series',
    status,
    source,
    sourceRootId,
    language,
    category,
    collection,
    tag,
    search,
    duplicatesOnly: String(duplicatesOnly) === 'true',
  }, offset, limitNum);
  res.json(withSummaryResult(result, String(summary) === 'true'));
}));

router.post('/upload/poster', upload.single('file'), (req, res) => {
  try {
    const assetUrl = req.file
      ? saveBufferAsset(req.file, 'posters')
      : saveDataUrlAsset(req.body?.dataUrl, 'posters');
    res.status(201).json({ url: assetUrl });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Poster upload failed.' });
  }
});

router.post('/upload/banner', upload.single('file'), (req, res) => {
  try {
    const assetUrl = req.file
      ? saveBufferAsset(req.file, 'banners')
      : saveDataUrlAsset(req.body?.dataUrl, 'banners');
    res.status(201).json({ url: assetUrl });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Banner upload failed.' });
  }
});

router.get('/scanner/roots', (req, res) => {
  res.json({ items: loadScannerRoots() });
});

router.get('/scanner/drafts', asyncRoute(async (req, res) => {
  const latestOnly = req.query.latestOnly !== 'false';
  const latestRunId = latestOnly ? getScannerRuns(1)[0]?.id : '';
  const result = await listItems({
    source: 'scanner',
    status: req.query.status || 'draft',
    ...(latestRunId ? { scanRunId: latestRunId } : {}),
  }, 0, null);
  res.json(result);
}));

router.get('/scanner/logs', (req, res) => {
  const limit = Number(req.query.limit || 10);
  res.json({ items: getScannerRuns(limit), total: getScannerRuns(limit).length });
});

router.get('/scanner/health', asyncRoute(async (req, res) => {
  res.json(await getScannerHealth());
}));

router.get('/scanner/jobs/current', (req, res) => {
  res.json({ job: getCurrentScanJob() });
});

router.post('/scanner/run', (req, res) => {
  const rootIds = Array.isArray(req.body?.rootIds) ? req.body.rootIds : [];
  const job = startScanJob(rootIds);
  res.status(202).json({ job });
});

router.post('/scanner/stop', (req, res) => {
  const job = stopScanJob();
  res.status(202).json({ job });
});

router.get('/db/health', asyncRoute(async (req, res) => {
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
}));

router.get('/media-normalizer/status', asyncRoute(async (req, res) => {
  res.json(await getMediaNormalizerStatus());
}));

router.post('/media-normalizer/start', asyncRoute(async (req, res) => {
  res.status(202).json(await startMediaNormalizer());
}));

router.post('/media-normalizer/stop', asyncRoute(async (req, res) => {
  res.status(202).json(await stopMediaNormalizer());
}));

router.get('/duplicates/review', (req, res) => {
  res.json(getDuplicateReviewReport());
});

router.post('/duplicates/cleanup', (req, res) => {
  res.status(202).json(runDuplicateCleanup());
});

router.post('/metadata/tmdb', asyncRoute(async (req, res) => {
  try {
    const tmdbId = Number(req.body?.tmdbId);
    const mediaType = req.body?.type || 'movie';

    if (!tmdbId) {
      return res.status(400).json({ error: 'Valid TMDb ID is required.' });
    }

    const metadata = await fetchMetadataByTmdbId(tmdbId, mediaType);
    return res.json({ metadata });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'TMDb import failed.' });
  }
}));

router.post('/seed-test-data', asyncRoute(async (req, res) => {
  const SAMPLE_MOVIES = [
    {
      id: 1001,
      title: 'The Journey Begins',
      type: 'movie',
      status: 'published',
      genre: 'Action',
      year: 2024,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
      backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200',
      rating: 8.2,
      duration: 142,
      description: 'An epic adventure film filled with action and mystery.',
      director: 'John Smith',
      cast: ['Tom Hardy', 'Emma Stone'],
    },
    {
      id: 1002,
      title: 'Heart of Gold',
      type: 'movie',
      status: 'published',
      genre: 'Drama',
      year: 2023,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400',
      backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200',
      rating: 7.9,
      duration: 128,
      description: 'A touching story about love, loss, and redemption.',
      director: 'Sarah Johnson',
      cast: ['Saoirse Ronan', 'Timothée Chalamet'],
    },
    {
      id: 1003,
      title: 'Laugh Track',
      type: 'movie',
      status: 'published',
      genre: 'Comedy',
      year: 2024,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1495997622626-f1fbb8e068aa?w=400',
      backdrop: 'https://images.unsplash.com/photo-1495997622626-f1fbb8e068aa?w=1200',
      rating: 7.1,
      duration: 95,
      description: 'A hilarious comedy about everyday life mishaps.',
      director: 'Michael Chen',
      cast: ['Will Ferrell', 'Amy Poehler'],
    },
    {
      id: 1004,
      title: 'Midnight Terror',
      type: 'movie',
      status: 'published',
      genre: 'Horror',
      year: 2024,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
      backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200',
      rating: 7.4,
      duration: 105,
      description: 'A chilling horror experience that will keep you on edge.',
      director: 'Alex Rivera',
      cast: ['Jennifer Connelly', 'Tom Hardy'],
    },
    {
      id: 1005,
      title: 'Love in Paris',
      type: 'movie',
      status: 'published',
      genre: 'Romance',
      year: 2023,
      language: 'French',
      poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400',
      backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200',
      rating: 8.0,
      duration: 112,
      description: 'A romantic tale set in the city of love.',
      director: 'François Truffaut',
      cast: ['Léa Seydoux', 'Vincent Cassel'],
    },
  ];

  const SAMPLE_SERIES = [
    {
      id: 2001,
      title: 'Tech Titans',
      type: 'series',
      status: 'published',
      genre: 'Thriller',
      year: 2024,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1574609644844-fcf46c1e1e2c?w=400',
      backdrop: 'https://images.unsplash.com/photo-1574609644844-fcf46c1e1e2c?w=1200',
      rating: 8.5,
      seasons: 2,
      episodes: 24,
      description: 'Follow the rise of ambitious tech entrepreneurs in Silicon Valley.',
      creator: 'David Fincher',
      cast: ['Adam Scott', 'Tracee Ellis Ross'],
    },
    {
      id: 2002,
      title: 'Mystery Island',
      type: 'series',
      status: 'published',
      genre: 'Adventure',
      year: 2023,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
      backdrop: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
      rating: 8.3,
      seasons: 1,
      episodes: 10,
      description: 'A group of friends must solve the mysteries of an uncharted island.',
      creator: 'J.J. Abrams',
      cast: ['Oscar Isaac', 'Elizabeth Olsen'],
    },
    {
      id: 2003,
      title: 'Legal Minds',
      type: 'series',
      status: 'published',
      genre: 'Drama',
      year: 2024,
      language: 'English',
      poster: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      backdrop: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200',
      rating: 8.1,
      seasons: 3,
      episodes: 36,
      description: 'High-stakes legal battles and personal drama in a prestigious law firm.',
      creator: 'Peter Nowalk',
      cast: ['Viola Davis', 'Alfred Enoch'],
    },
  ];

  const results = { movies: [], series: [], errors: [] };

  for (const movie of SAMPLE_MOVIES) {
    try {
      await createItem(movie);
      results.movies.push(movie.title);
    } catch (err) {
      results.errors.push(`Failed to add movie ${movie.title}: ${err.message}`);
    }
  }

  for (const series of SAMPLE_SERIES) {
    try {
      await createItem(series);
      results.series.push(series.title);
    } catch (err) {
      results.errors.push(`Failed to add series ${series.title}: ${err.message}`);
    }
  }

  res.json({
    ok: true,
    message: 'Test data seeding complete',
    results,
  });
}));

module.exports = router;
