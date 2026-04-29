const express = require('express');
const router = express.Router();
const { listItems, searchItems } = require('../data/store');
const { setApiCacheHeaders } = require('../middleware/response-optimizer');
const HOMEPAGE_LIMIT = 30;

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getItemRecencyTimestamp(item) {
  const candidates = [
    item?.publishedAt,
    item?.releasedAt,
    item?.metadataUpdatedAt,
    item?.updatedAt,
    item?.createdAt,
  ];

  for (const value of candidates) {
    const timestamp = new Date(value || 0).getTime();
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }

  const numericYear = Number(item?.year || 0);
  if (Number.isFinite(numericYear) && numericYear > 1900) {
    return new Date(`${numericYear}-01-01T00:00:00.000Z`).getTime();
  }

  return 0;
}

function sortByLatest(items) {
  return [...items].sort((left, right) => {
    const recencyDelta = getItemRecencyTimestamp(right) - getItemRecencyTimestamp(left);
    if (recencyDelta !== 0) {
      return recencyDelta;
    }

    return Number(right?.id || 0) - Number(left?.id || 0);
  });
}

async function getPublishedItems(filters = {}, offset = 0, limit = null, sort = 'latest') {
  const { items } = await listItems({ ...filters, status: 'published' }, offset, limit, sort);
  return items;
}


function normalizeQueryValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value).trim();
  if (!normalized || normalized === 'undefined' || normalized === 'null' || normalized === 'All') {
    return '';
  }

  return normalized;
}

function normalizePositiveInt(value, defaultValue, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, min), max);
}

async function buildHomepagePayload(limit = HOMEPAGE_LIMIT) {
  const [featuredItems, latest, popular, trending, series] = await Promise.all([
    getPublishedItems({ featured: true }, 0, 1),
    getPublishedItems({}, 0, limit, 'latest'),
    getPublishedItems({}, 0, limit, 'popular'),
    getPublishedItems({}, 0, limit, 'trending'),
    getPublishedItems({ type: 'series' }, 0, limit, 'latest')
  ]);

  const featured = featuredItems[0] || latest[0] || null;

  return {
    featured,
    latest,
    popular,
    trending,
    series,
    generatedAt: new Date().toISOString(),
  };
}

router.get('/featured', asyncRoute(async (req, res) => {
  const items = await getPublishedItems({ featured: true }, 0, 1);
  const featured = items[0] || (await getPublishedItems({}, 0, 1))[0] || null;
  setApiCacheHeaders(res, req.originalUrl);
  res.json(featured);
}));

router.get('/', asyncRoute(async (req, res) => {
  const page = normalizePositiveInt(req.query.page, 1, { min: 1, max: 100000 });
  const limit = normalizePositiveInt(req.query.limit, 24, { min: 1, max: 100 });
  const sort = normalizeQueryValue(req.query.sort) || 'latest';

  const { items, total } = await listItems({ status: 'published' }, (page - 1) * limit, limit, sort);
  const featured = items.find(i => i.featured) || items[0] || null;

  setApiCacheHeaders(res, req.originalUrl);
  res.json({
    items,
    featured,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
}));

router.get('/latest', asyncRoute(async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, 10, { min: 1, max: 100 });
  const items = await getPublishedItems({}, 0, limit, 'latest');
  setApiCacheHeaders(res, req.originalUrl);
  res.json({ items });
}));

router.get('/popular', asyncRoute(async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, 10, { min: 1, max: 100 });
  const items = await getPublishedItems({}, 0, limit, 'popular');
  setApiCacheHeaders(res, req.originalUrl);
  res.json({ items });
}));

router.get('/trending', asyncRoute(async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, 10, { min: 1, max: 100 });
  const items = await getPublishedItems({}, 0, limit, 'trending');
  setApiCacheHeaders(res, req.originalUrl);
  res.json({ items });
}));

router.get('/homepage', asyncRoute(async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, HOMEPAGE_LIMIT, { min: 1, max: 100 });
  setApiCacheHeaders(res, req.originalUrl);
  res.json(await buildHomepagePayload(limit));
}));

router.get('/browse', asyncRoute(async (req, res) => {
  const type = normalizeQueryValue(req.query.type);
  const genre = normalizeQueryValue(req.query.genre);
  const language = normalizeQueryValue(req.query.language);
  const collection = normalizeQueryValue(req.query.collection);
  const tag = normalizeQueryValue(req.query.tag);
  const year = normalizeQueryValue(req.query.year);
  const q = normalizeQueryValue(req.query.q);
  const sort = normalizeQueryValue(req.query.sort) || 'latest';
  const page = normalizePositiveInt(req.query.page, 1, { min: 1, max: 100000 });
  const limit = normalizePositiveInt(req.query.limit, 20, { min: 1, max: 100 });

  const baseFilters = { status: 'published' };
  if (type) baseFilters.type = type;
  if (genre) baseFilters.genre = genre;
  if (language) baseFilters.language = language;
  if (collection) baseFilters.collection = collection;
  if (tag) baseFilters.tag = tag;
  if (year) baseFilters.year = year;

  const offset = (page - 1) * limit;
  let { items, total } = q
    ? await searchItems(q, baseFilters)
    : await listItems(baseFilters, offset, limit, sort);

  if (q) {
    total = items.length;
    items = items.slice(offset, offset + limit);
  }

  res.json({
    items,
    total,
    page,
    limit,
    query: q,
    nextPage: offset + items.length < total ? page + 1 : null,
    hasMore: offset + items.length < total,
  });
}));

module.exports = router;
