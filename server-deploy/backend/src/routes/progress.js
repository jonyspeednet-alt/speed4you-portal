const express = require('express');
const router = express.Router();
const {
  getItemById,
  getWatchProgressEntries,
  markWatchProgressComplete,
  upsertWatchProgress,
} = require('../data/store');

function getUserId(req) {
  const authHeader = req.headers.authorization || '';
  return req.headers['x-user-id'] || authHeader || 'guest';
}

router.get('/', async (req, res) => {
  const userId = getUserId(req);
  const entries = await getWatchProgressEntries(userId, { incompleteOnly: true });
  const userProgress = [];
  for (const entry of entries) {
    const item = await getItemById(entry.contentId);
    userProgress.push(item ? { ...item, ...entry, last_position: entry.position } : { ...entry, last_position: entry.position });
  }

  res.json({ items: userProgress });
});

router.post('/', async (req, res) => {
  const userId = getUserId(req);
  const { contentType, contentId, position, duration } = req.body;

  if (!contentType || !contentId) {
    return res.status(400).json({ error: 'contentType and contentId required' });
  }

  await upsertWatchProgress(userId, { contentType, contentId, position, duration, completed: false });

  res.json({ success: true });
});

async function buildContinueWatching(userId) {
  const entries = await getWatchProgressEntries(userId, { incompleteOnly: true });
  const items = [];
  for (const entry of entries.filter((item) => Number(item.position) > 0)) {
    const item = await getItemById(entry.contentId);
    if (item) {
      items.push({ ...item, ...entry, last_position: entry.position });
    }
  }

  return items;
}

router.get('/continue-watching', async (req, res) => {
  const userId = getUserId(req);
  res.json({ items: await buildContinueWatching(userId) });
});

router.get('/continue-watching/list', async (req, res) => {
  const userId = getUserId(req);
  const items = await buildContinueWatching(userId);

  res.json({ items });
});

router.post('/complete', async (req, res) => {
  const userId = getUserId(req);
  const { contentType, contentId } = req.body;
  await markWatchProgressComplete(userId, { contentType, contentId });

  res.json({ success: true });
});

router.get('/:contentType/:contentId', async (req, res) => {
  const userId = getUserId(req);
  const { contentType, contentId } = req.params;
  const [item] = await getWatchProgressEntries(userId, { contentType, contentId });

  res.json(item ? { ...item, last_position: item.position } : { progress: null });
});

module.exports = router;
