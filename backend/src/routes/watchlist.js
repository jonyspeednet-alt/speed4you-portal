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
const { AppError } = require('../utils/error');

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
      throw new AppError('Valid contentType and contentId required', 400, 'BAD_REQUEST');
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
      throw new AppError('contentType and contentId required', 400, 'BAD_REQUEST');
    }

    const numericContentId = Number(contentId);
    if (!Number.isFinite(numericContentId) || numericContentId <= 0) {
      throw new AppError('contentId must be a positive number', 400, 'BAD_REQUEST');
    }

    const item = await getItemById(numericContentId);
    if (!item) {
      throw new AppError('Content not found', 404, 'NOT_FOUND');
    }

    const created = await addWatchlistEntry(userId, contentType, numericContentId);
    if (!created) {
      throw new AppError('Already in watchlist', 409, 'CONFLICT');
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
      throw new AppError('Item not found', 404, 'NOT_FOUND');
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
