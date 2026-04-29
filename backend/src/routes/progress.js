const express = require('express');
const router = express.Router();
const {
  getItemById,
  getItemsByIds,
  getWatchProgressEntries,
  markWatchProgressComplete,
  upsertWatchProgress,
} = require('../data/store');
const { resolveUserId, requireStateUser } = require('../middleware/resolve-user-id');
const { AppError } = require('../utils/error');

function getUserId(req) {
  return req.stateUserId || resolveUserId(req);
}

router.get('/', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const entries = await getWatchProgressEntries(userId, { incompleteOnly: true });

    if (!entries.length) {
      return res.json({ items: [] });
    }

    const contentIds = entries.map((e) => e.contentId).filter(Boolean);
    const itemsMap = await getItemsByIds(contentIds);

    const userProgress = entries.map((entry) => {
      const item = itemsMap.get(Number(entry.contentId));
      return item ? { ...item, ...entry, id: Number(entry.contentId), progressId: entry.id, last_position: entry.position } : { ...entry, last_position: entry.position };
    });

    res.json({ items: userProgress });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { contentType, contentId, position, duration } = req.body;

    if (!contentType || !contentId) {
      throw new AppError('contentType and contentId required', 400, 'BAD_REQUEST');
    }

    const numericContentId = Number(contentId);
    if (!Number.isFinite(numericContentId) || numericContentId <= 0) {
      throw new AppError('contentId must be a positive number', 400, 'BAD_REQUEST');
    }

    const numericPosition = Number(position) || 0;
    const numericDuration = Number(duration) || 0;

    await upsertWatchProgress(userId, {
      contentType,
      contentId: numericContentId,
      position: numericPosition,
      duration: numericDuration,
      completed: false,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

async function buildContinueWatching(userId) {
  const entries = await getWatchProgressEntries(userId, { incompleteOnly: true });
  const activeEntries = entries.filter((item) => Number(item.position) > 0);

  if (!activeEntries.length) {
    return [];
  }

  const contentIds = activeEntries.map((e) => e.contentId).filter(Boolean);
  const itemsMap = await getItemsByIds(contentIds);

  return activeEntries
    .filter((entry) => itemsMap.has(Number(entry.contentId)))
    .map((entry) => ({ ...itemsMap.get(Number(entry.contentId)), ...entry, id: Number(entry.contentId), progressId: entry.id, last_position: entry.position }));
}

router.get('/continue-watching', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    res.json({ items: await buildContinueWatching(userId) });
  } catch (error) {
    next(error);
  }
});

router.get('/continue-watching/list', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const items = await buildContinueWatching(userId);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/complete', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { contentType, contentId } = req.body;
    await markWatchProgressComplete(userId, { contentType, contentId });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:contentType/:contentId', requireStateUser, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { contentType, contentId } = req.params;
    const [item] = await getWatchProgressEntries(userId, { contentType, contentId });
    res.json(item ? { ...item, last_position: item.position } : { progress: null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
