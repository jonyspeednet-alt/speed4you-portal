const express = require('express');
const router = express.Router();
const {
  getItemById,
  getWatchProgressEntries,
  markWatchProgressComplete,
  upsertWatchProgress,
} = require('../data/store');
const { resolveUserId, requireStateUser } = require('../middleware/resolve-user-id');

function getUserId(req) {
  return req.stateUserId || resolveUserId(req);
}

router.get('/', requireStateUser, async (req, res) => {
  const userId = getUserId(req);
  const entries = await getWatchProgressEntries(userId, { incompleteOnly: true });
  const userProgress = [];
  for (const entry of entries) {
    const item = await getItemById(entry.contentId);
    userProgress.push(item ? { ...item, ...entry, last_position: entry.position } : { ...entry, last_position: entry.position });
  }

  res.json({ items: userProgress });
});

router.post('/', requireStateUser, async (req, res) => {
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

router.get('/continue-watching', requireStateUser, async (req, res) => {
  const userId = getUserId(req);
  res.json({ items: await buildContinueWatching(userId) });
});

router.get('/continue-watching/list', requireStateUser, async (req, res) => {
  const userId = getUserId(req);
  const items = await buildContinueWatching(userId);

  res.json({ items });
});

router.post('/complete', requireStateUser, async (req, res) => {
  const userId = getUserId(req);
  const { contentType, contentId } = req.body;
  await markWatchProgressComplete(userId, { contentType, contentId });

  res.json({ success: true });
});

router.get('/:contentType/:contentId', requireStateUser, async (req, res) => {
  const userId = getUserId(req);
  const { contentType, contentId } = req.params;
  const [item] = await getWatchProgressEntries(userId, { contentType, contentId });

  res.json(item ? { ...item, last_position: item.position } : { progress: null });
});

module.exports = router;
