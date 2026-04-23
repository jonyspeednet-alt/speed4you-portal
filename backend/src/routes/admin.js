const express = require('express');
const fs = require('fs');
const path = require('path');
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
  updateItem,
} = require('../data/store');
const { getCurrentScanJob, getScannerHealth, startScanJob } = require('../services/scanner');
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

function saveDataUrlAsset(dataUrl, folder = 'images') {
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

  const uploadRoot = resolveUploadDirectory();
  const targetDir = path.join(uploadRoot, folder);
  fs.mkdirSync(targetDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
  const absolutePath = path.join(targetDir, filename);
  fs.writeFileSync(absolutePath, Buffer.from(match[2], 'base64'));

  return `/portal/uploads/${folder}/${filename}`;
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
  const { status, type, source, sourceRootId, language, category, collection, tag, search, page, limit } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const result = await listItems({ status, type, source, sourceRootId, language, category, collection, tag, search }, offset, limitNum);
  res.json(result);
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
  const { status, source, sourceRootId, language, category, collection, tag, search, page, limit } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const result = await listItems({ type: 'movie', status, source, sourceRootId, language, category, collection, tag, search }, offset, limitNum);
  res.json(result);
}));

router.get('/series', asyncRoute(async (req, res) => {
  const { status, source, sourceRootId, language, category, collection, tag, search, page, limit } = req.query;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const result = await listItems({ type: 'series', status, source, sourceRootId, language, category, collection, tag, search }, offset, limitNum);
  res.json(result);
}));

router.post('/upload/poster', (req, res) => {
  try {
    const assetUrl = saveDataUrlAsset(req.body?.dataUrl, 'posters');
    res.status(201).json({ url: assetUrl });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Poster upload failed.' });
  }
});

router.post('/upload/banner', (req, res) => {
  try {
    const assetUrl = saveDataUrlAsset(req.body?.dataUrl, 'banners');
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

module.exports = router;
