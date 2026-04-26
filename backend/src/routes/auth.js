const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { findAdminByUsername, touchAdminLogin } = require('../data/store');
const { getJwtSecret } = require('../config/auth');
const { Joi, validateBody } = require('../middleware/validate');

const SECRET = getJwtSecret();
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

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.validatedBody;

    const admin = await findAdminByUsername(username);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await touchAdminLogin(admin.id);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: admin.id, username: admin.username, role: admin.role } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

function verifyToken(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    return res.json({ valid: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }
}

router.get('/verify', verifyToken);
router.post('/verify', verifyToken);

router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

router.post('/refresh', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    const refreshedToken = jwt.sign(
      { id: decoded.id, username: decoded.username, role: decoded.role },
      SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token: refreshedToken,
      user: { id: decoded.id, username: decoded.username, role: decoded.role },
    });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
