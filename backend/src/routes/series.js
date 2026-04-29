const express = require('express');
const router = express.Router();
const { getItemById, listItems } = require('../data/store');
const { Joi, validateQuery } = require('../middleware/validate');
const { AppError } = require('../utils/error');

const seriesQuerySchema = Joi.object({
  genre: Joi.string().trim().min(1).max(80),
  year: Joi.alternatives().try(Joi.number().integer().min(1900).max(2100), Joi.string().trim().pattern(/^\d{4}$/)),
  sort: Joi.string().valid('latest', 'popular', 'trending', 'rating', 'featured').default('latest'),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
});

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

router.get('/:id', async (req, res, next) => {
  try {
    const show = await getItemById(req.params.id);
    if (!show || show.type !== 'series') {
      throw new AppError('Series not found', 404, 'NOT_FOUND');
    }
    res.json(show);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/seasons', async (req, res, next) => {
  try {
    const show = await getItemById(req.params.id);
    if (!show || show.type !== 'series') {
      throw new AppError('Series not found', 404, 'NOT_FOUND');
    }
    res.json({
      seasons: (show.seasons || []).map((season) => ({
        id: season.id,
        number: season.number,
        title: season.title,
        episodes: season.episodes?.length || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/seasons/:seasonId/episodes', async (req, res, next) => {
  try {
    const show = await getItemById(req.params.id);
    if (!show || show.type !== 'series') {
      throw new AppError('Series not found', 404, 'NOT_FOUND');
    }
    const season = (show.seasons || []).find((item) => String(item.id) === req.params.seasonId || String(item.number) === req.params.seasonId);
    if (!season) {
      throw new AppError('Season not found', 404, 'NOT_FOUND');
    }
    res.json({ episodes: season.episodes || [] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
