const express = require('express');
const router = express.Router();
const { getItemById, listItems } = require('../data/store');

function getMovies() {
  return listItems({ type: 'movie', status: 'published' }).then((result) => result.items);
}

router.get('/', async (req, res) => {
  const { genre, year } = req.query;
  let filtered = await getMovies();
  
  if (genre) {
    filtered = filtered.filter((movie) => (movie.genre || '').includes(genre));
  }
  if (year) {
    filtered = filtered.filter((movie) => Number(movie.year) === parseInt(year, 10));
  }
  
  res.json({ movies: filtered, total: filtered.length });
});

router.get('/:id', async (req, res) => {
  const movie = await getItemById(req.params.id);
  if (!movie || movie.type !== 'movie') {
    return res.status(404).json({ error: 'Movie not found' });
  }
  res.json(movie);
});

module.exports = router;
