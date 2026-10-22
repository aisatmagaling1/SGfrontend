const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const realtime = require('../services/realtime');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MS = 12 * 60 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in a few minutes.' },
});

function startSession(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MS,
  });
}

router.post('/signup', async (req, res, next) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (fullName.length < 2 || fullName.length > 80) {
      return res.status(400).json({ message: 'Enter your full name.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Use a password with at least 8 characters.' });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ fullName, email, passwordHash });
    realtime.emitToRoles(['hr'], 'users:changed', {});
    res.status(201).json({ message: 'Account created. HR must approve it before you can log in.' });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const user = await User.findOne({ email });
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!ok) return res.status(401).json({ message: 'Email or password is incorrect.' });

    if (user.status === 'pending') {
      return res.status(403).json({
        code: 'PENDING',
        message: 'Your account is waiting for HR approval. You can log in once HR approves it.',
      });
    }
    if (user.status === 'disabled') {
      return res.status(403).json({
        code: 'DISABLED',
        message: 'This account is turned off. Contact HR.',
      });
    }

    startSession(res, user);
    res.json({ user: user.toSession() });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSession() });
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Use a new password with at least 8 characters.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Choose a password different from the current one.' });
    }

    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    req.user.mustChangePassword = false;
    await req.user.save();
    res.json({ message: 'Password changed.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
