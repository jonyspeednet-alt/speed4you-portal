const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { findAdminByUsername, touchAdminLogin } = require('../data/store');
const { getJwtSecret } = require('../config/auth');
const { Joi, validateBody } = require('../middleware/validate');
const { AppError } = require('../utils/error');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const loginSchema = Joi.object({
  username: Joi.string().trim().alphanum().min(2).max(64).required(),
  password: Joi.string().min(1).max(256).required(),
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.validatedBody;

    const admin = await findAdminByUsername(username);
    if (!admin) {
      throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');
    }

    await touchAdminLogin(admin.id);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: admin.id, username: admin.username, role: admin.role } });
  } catch (error) {
    next(error);
  }
});

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new AppError('No token provided', 401, 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return res.json({ valid: true, user: decoded });
  } catch (err) {
    return next(new AppError('Invalid token', 401, 'UNAUTHORIZED'));
  }
}

router.get('/verify', verifyToken);
router.post('/verify', verifyToken);

router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

router.post('/refresh', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new AppError('No token provided', 401, 'UNAUTHORIZED'));
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const refreshedToken = jwt.sign(
      { id: decoded.id, username: decoded.username, role: decoded.role },
      secret,
      { expiresIn: '24h' }
    );

    return res.json({
      token: refreshedToken,
      user: { id: decoded.id, username: decoded.username, role: decoded.role },
    });
  } catch {
    return next(new AppError('Invalid token', 401, 'UNAUTHORIZED'));
  }
});

module.exports = router;
