const express = require('express');
const router = express.Router();
const { listItems, searchItems } = require('../data/store');
const HOMEPAGE_LIMIT = 30;

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

// Removed getPublishedItems() - use listItems({status:'published', offset, limit}) directly


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
  const publishedItems = await getPublishedItems();
  const featured = publishedItems.find((item) => item.featured) || publishedItems[0] || null;
  const latest = sortByLatest(publishedItems).slice(0, limit);
  const popular = [...publishedItems]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, limit);
  const trending = [...publishedItems]
    .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
    .slice(0, limit);
  const series = publishedItems
    .filter((item) => item.type === 'series')
    .slice(0, limit);

  return {
    featured,
    latest,
    popular,
    trending,
    series,
    generatedAt: new Date().toISOString(),
  };
}

router.get('/featured', async (req, res) => {
  const items = await getPublishedItems();
  const featured = items.find((item) => item.featured) || items[0] || null;
  res.json(featured);
});

router.get('/', async (req, res) => {
  const items = await getPublishedItems();
  const featured = items.find((item) => item.featured) || items[0] || null;
  const page = normalizePositiveInt(req.query.page, 1, { min: 1, max: 100000 });
  const limit = normalizePositiveInt(req.query.limit, 24, { min: 1, max: 100 });
  const includeAll = req.query.all === '1';
  const pagedItems = includeAll ? items : items.slice((page - 1) * limit, (page - 1) * limit + limit);

  res.json({
    items: pagedItems,
    featured,
    total: items.length,
    page: includeAll ? 1 : page,
    limit: includeAll ? items.length : limit,
    hasMore: includeAll ? false : page * limit < items.length,
  });
});

router.get('/latest', async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, 10, { min: 1, max: 100 });
  const items = (await getPublishedItems()).slice(0, limit);
  res.json({ items });
});

router.get('/popular', async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, 10, { min: 1, max: 100 });
  const items = [...await getPublishedItems()]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, limit);
  res.json({ items });
});

router.get('/trending', async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, 10, { min: 1, max: 100 });
  const items = [...await getPublishedItems()]
    .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
    .slice(0, limit);
  res.json({ items });
});

router.get('/homepage', async (req, res) => {
  const limit = normalizePositiveInt(req.query.limit, HOMEPAGE_LIMIT, { min: 1, max: 100 });
  res.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=120');
  res.json(await buildHomepagePayload(limit));
});

router.get('/browse', async (req, res) => {
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

  let { items, total } = q
    ? await searchItems(q, baseFilters)
    : await listItems(baseFilters, (page - 1) * limit, limit);

  // Server-side filtering/pagination now handles type/genre/etc

  if (q) {
    if (sort === 'trending') {
      items = [...items].sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0) || (b.trendingScore || 0) - (a.trendingScore || 0));
    } else if (sort === 'popular' || sort === 'rating') {
      items = [...items].sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (sort === 'featured') {
      items = [...items].sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0) || (Number(b.featuredOrder) || 0) - (Number(a.featuredOrder) || 0));
    } else {
      items = [...items].sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0) || getItemRecencyTimestamp(b) - getItemRecencyTimestamp(a));
    }
  } else if (sort === 'featured') {
    items = [...items].sort((a, b) => (Number(b.featuredOrder) || 0) - (Number(a.featuredOrder) || 0) || (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  } else if (sort === 'trending') {
    items = [...items].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
  } else if (sort === 'popular' || sort === 'rating') {
    items = [...items].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sort === 'latest') {
    items = sortByLatest(items);
  }

  const offset = (page - 1) * limit;
  res.json({
    items,
    total: total || items.length,
    page,
    limit,
    query: q,
  });
});

module.exports = router;
