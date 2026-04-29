const express = require('express');
const router = express.Router();
const { getItemById, listItems } = require('../data/store');
const { Joi, validateQuery } = require('../middleware/validate');
const { AppError } = require('../utils/error');

const moviesQuerySchema = Joi.object({
  genre: Joi.string().trim().min(1).max(80),
  year: Joi.alternatives().try(Joi.number().integer().min(1900).max(2100), Joi.string().trim().pattern(/^\d{4}$/)),
  sort: Joi.string().valid('latest', 'popular', 'trending', 'rating', 'featured').default('latest'),
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
});

router.get('/', validateQuery(moviesQuerySchema), async (req, res, next) => {
  const { genre, year, sort, page, limit } = req.validatedQuery;
  const filters = { type: 'movie', status: 'published' };

  if (genre) filters.genre = genre;
  if (year) filters.year = year;

  try {
    const offset = (page - 1) * limit;
    const { items, total } = await listItems(filters, offset, limit, sort);
    res.json({
      movies: items,
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
    const movie = await getItemById(req.params.id);
    if (!movie || movie.type !== 'movie') {
      throw new AppError('Movie not found', 404, 'NOT_FOUND');
    }
    res.json(movie);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
