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

function getUserId(req) {
  return req.stateUserId || resolveUserId(req);
}

function normalizeDuration(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue <= 400 ? numericValue * 60 : numericValue;
}

function buildWatchProgressItem(item, entry) {
  const position = Number(entry.position || 0);
  const rawDuration = Number(entry.duration || 0) || Number(item?.durationSeconds || 0) || normalizeDuration(item?.duration || item?.runtime || item?.runtimeMinutes || 0);
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
  const progress = duration > 0 ? Math.min(100, Math.max(0, Math.round((position / duration) * 100))) : 0;

  return {
    ...item,
    ...entry,
    last_position: position,
    progress,
    duration,
  };
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
      return buildWatchProgressItem(item || {}, entry);
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
      return res.status(400).json({ error: 'contentType and contentId required' });
    }

    await upsertWatchProgress(userId, { contentType, contentId, position, duration, completed: false });

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
    .map((entry) => ({ ...itemsMap.get(Number(entry.contentId)), ...entry, last_position: entry.position }));
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
