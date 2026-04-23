const express = require('express');
const router = express.Router();
const { getItemById, listItems } = require('../data/store');
const { Joi, validateQuery } = require('../middleware/validate');

const seriesQuerySchema = Joi.object({
  genre: Joi.string().trim().min(1).max(80),
  year: Joi.alternatives().try(Joi.number().integer().min(1900).max(2100), Joi.string().trim().pattern(/^\d{4}$/)),
  sort: Joi.string().valid('latest', 'popular', 'trending', 'rating', 'featured').default('latest'),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
});

function getSeries() {
  return listItems({ type: 'series', status: 'published' }).then((result) => result.items);
}

router.get('/', validateQuery(seriesQuerySchema), async (req, res, next) => {
  const { genre, year, sort, page, limit } = req.validatedQuery;
  const filters = { type: 'series', status: 'published' };
  
  if (genre) filters.genre = genre;
  if (year) filters.year = year;

  try {
    const offset = (page - 1) * limit;
    const { items, total } = await listItems(filters, offset, limit, sort);
    res.json({
      series: items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res) => {
  const show = await getItemById(req.params.id);
  if (!show || show.type !== 'series') {
    return res.status(404).json({ error: 'Series not found' });
  }
  res.json(show);
});

router.get('/:id/seasons', async (req, res) => {
  const show = await getItemById(req.params.id);
  if (!show || show.type !== 'series') {
    return res.status(404).json({ error: 'Series not found' });
  }
  res.json({
    seasons: (show.seasons || []).map((season) => ({
      id: season.id,
      number: season.number,
      title: season.title,
      episodes: season.episodes?.length || 0,
    })),
  });
});

router.get('/:id/seasons/:seasonId/episodes', async (req, res) => {
  const show = await getItemById(req.params.id);
  if (!show || show.type !== 'series') {
    return res.status(404).json({ error: 'Series not found' });
  }
  const season = (show.seasons || []).find((item) => String(item.id) === req.params.seasonId || String(item.number) === req.params.seasonId);
  if (!season) {
    return res.status(404).json({ error: 'Season not found' });
  }
  res.json({ episodes: season.episodes || [] });
});

module.exports = router;
