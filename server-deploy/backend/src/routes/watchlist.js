const express = require('express');
const router = express.Router();
const {
  addWatchlistEntry,
  getItemById,
  getItemsByIds,
  getWatchlistEntries,
  removeWatchlistEntry,
} = require('../data/store');
const { resolveUserId, requireStateUser } = require('../middleware/resolve-user-id');

function getUserId(req) {
  return req.stateUserId || resolveUserId(req);
}

router.get('/', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const entries = await getWatchlistEntries(userId);

    if (!entries.length) {
      return res.json({ items: [], total: 0 });
    }

    const contentIds = entries.map((e) => e.contentId).filter(Boolean);
    const itemsMap = await getItemsByIds(contentIds);

    const userList = entries.map((entry) => {
      const item = itemsMap.get(Number(entry.contentId));
      return item ? { ...entry, ...item } : entry;
    });

    res.json({ items: userList, total: userList.length });
  } catch (error) {
    next(error);
  }
});

router.get('/check', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const contentType = String(req.query.contentType || '').trim();
    const contentId = Number(req.query.contentId);

    if (!contentType || !Number.isFinite(contentId) || contentId <= 0) {
      return res.status(400).json({ error: 'Valid contentType and contentId required' });
    }

    const entries = await getWatchlistEntries(userId);
    const matchedEntry = entries.find((entry) => (
      String(entry.contentType || '').toLowerCase() === contentType.toLowerCase()
      && Number(entry.contentId) === contentId
    ));

    res.json({
      inWatchlist: Boolean(matchedEntry),
      entryId: matchedEntry?.id || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireStateUser, async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const removed = await removeWatchlistEntry(userId, req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
