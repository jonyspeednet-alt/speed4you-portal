const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findAdminByUsername, touchAdminLogin } = require('../data/store');

const SECRET = process.env.JWT_SECRET || 'isp-secret-key-change-in-production';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
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
