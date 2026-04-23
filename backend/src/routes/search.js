const express = require('express');
const router = express.Router();
const { getSuggestions, searchItems } = require('../data/store');

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

router.get('/', async (req, res) => {
  const q = normalizeQueryValue(req.query.q);
  const type = normalizeQueryValue(req.query.type);
  const genre = normalizeQueryValue(req.query.genre);
  const language = normalizeQueryValue(req.query.language);
  const year = normalizeQueryValue(req.query.year);

  if (!q || q.length < 2) {
    return res.json({ results: [], total: 0, suggestions: [] });
  }

  let results = await searchItems(q, { type, genre, language, status: 'published' });

  if (year) {
    results = results.filter((item) => Number(item.year) === Number(year));
  }

  res.json({
    results: results.slice(0, 60),
    total: results.length,
    suggestions: await getSuggestions(q, 8),
  });
});

router.get('/suggestions', async (req, res) => {
  const q = normalizeQueryValue(req.query.q);
  if (!q || q.length < 2) {
    return res.json({ items: [] });
  }

  return res.json({ items: await getSuggestions(q, 10) });
});

router.get('/recent', (req, res) => {
  res.json({ items: [] });
});

module.exports = router;
