const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/auth');

const REQUIRE_USER_AUTH_FOR_STATE = String(process.env.REQUIRE_USER_AUTH_FOR_STATE || '0') === '1';

function resolveUserId(req) {
  const explicitUserId = String(req.headers['x-user-id'] || '').trim();
  if (explicitUserId) {
    return explicitUserId;
  }

  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        if (decoded && decoded.id) {
          return `user:${decoded.id}`;
        }
      } catch {
        // Ignore invalid token and treat as guest user for public routes.
      }
    }
  }

  return 'guest';
}

function requireStateUser(req, res, next) {
  const userId = resolveUserId(req);
  if (REQUIRE_USER_AUTH_FOR_STATE && userId === 'guest') {
    return res.status(401).json({ error: 'Authentication required for this action' });
  }

  req.stateUserId = userId;
  return next();
}

module.exports = {
  resolveUserId,
  requireStateUser,
};
