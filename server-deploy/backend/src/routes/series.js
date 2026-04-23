const express = require('express');
const router = express.Router();
const { getItemById, listItems } = require('../data/store');

function getSeries() {
  return listItems({ type: 'series', status: 'published' }).then((result) => result.items);
}

router.get('/', async (req, res) => {
  const { genre, year } = req.query;
  let filtered = await getSeries();
  
  if (genre) {
    filtered = filtered.filter((item) => (item.genre || '').includes(genre));
  }
  if (year) {
    filtered = filtered.filter((item) => Number(item.year) === Number(year));
  }
  
  res.json({ series: filtered, total: filtered.length });
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
