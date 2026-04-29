const express = require('express');
const router = express.Router();
const { getRecentSearches, getSuggestions, recordRecentSearch, searchItems } = require('../data/store');
const { Joi, validateQuery } = require('../middleware/validate');
const { resolveUserId } = require('../middleware/resolve-user-id');

const searchQuerySchema = Joi.object({
  q: Joi.string().trim().allow('').max(160).default(''),
  type: Joi.string().valid('movie', 'series').allow('').default(''),
  genre: Joi.string().trim().allow('').max(80).default(''),
  language: Joi.string().trim().allow('').max(40).default(''),
  year: Joi.alternatives().try(Joi.number().integer().min(1900).max(2100), Joi.string().trim().pattern(/^\d{4}$/), Joi.string().allow('')).default(''),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
});

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

router.get('/', validateQuery(searchQuerySchema), async (req, res, next) => {
  const q = normalizeQueryValue(req.validatedQuery.q);
  const type = normalizeQueryValue(req.validatedQuery.type);
  const genre = normalizeQueryValue(req.validatedQuery.genre);
  const language = normalizeQueryValue(req.validatedQuery.language);
  const year = normalizeQueryValue(req.validatedQuery.year);
  const page = req.validatedQuery.page;
  const limit = req.validatedQuery.limit;

  if (!q || q.length < 2) {
    return res.json({ results: [], total: 0, suggestions: [], page, limit, hasMore: false });
  }

  try {
    const searchResult = await searchItems(q, { type, genre, language, year, status: 'published' });
    const results = searchResult.items || [];
    const offset = (page - 1) * limit;
    const pagedResults = results.slice(offset, offset + limit);
    const userId = resolveUserId(req);
    if (results.length > 0) {
      await recordRecentSearch(userId, q, { type, genre, language, year });
    }

    res.json({
      results: pagedResults,
      total: results.length,
      suggestions: await getSuggestions(q, 8),
      page,
      limit,
      hasMore: page * limit < results.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/suggestions', async (req, res, next) => {
  try {
    const q = normalizeQueryValue(req.query.q);
    if (!q || q.length < 2) {
      return res.json({ items: [] });
    }
    return res.json({ items: await getSuggestions(q, 10) });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const items = await getRecentSearches(userId, 10);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
