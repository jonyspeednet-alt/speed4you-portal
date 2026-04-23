const express = require('express');
const router = express.Router();
const {
  addWatchlistEntry,
  getItemById,
  getWatchlistEntries,
  removeWatchlistEntry,
} = require('../data/store');

function getUserId(req) {
  const authHeader = req.headers.authorization || '';
  return req.headers['x-user-id'] || authHeader || 'guest';
}

router.get('/', async (req, res) => {
  const userId = getUserId(req);
  const entries = await getWatchlistEntries(userId);
  const userList = [];
  for (const entry of entries) {
    const item = await getItemById(entry.contentId);
    userList.push(item ? { ...entry, ...item } : entry);
  }

  res.json({ items: userList, total: userList.length });
});

router.post('/', async (req, res) => {
  const userId = getUserId(req);
  const { contentType, contentId } = req.body;

  if (!contentType || !contentId) {
    return res.status(400).json({ error: 'contentType and contentId required' });
  }

  const item = await getItemById(contentId);
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }

  const created = await addWatchlistEntry(userId, contentType, contentId);
  if (!created) {
    return res.status(409).json({ error: 'Already in watchlist' });
  }

  res.status(201).json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  const removed = await removeWatchlistEntry(userId, req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json({ success: true });
});

module.exports = router;
