const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { ROLES, STATUSES } = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { log } = require('../models/AuditLog');
const realtime = require('../services/realtime');

const router = express.Router();
router.use(requireAuth, requireRole('hr'));

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users: users.map((u) => u.toAdminView()) });
  } catch (err) {
    next(err);
  }
});

// Approve an account, assign or change a role, assign supervisor/manager,
// or turn an account on or off.
router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw bad('User not found.', 404);
    const target = await User.findById(req.params.id);
    if (!target) throw bad('User not found.', 404);
    if (target.id === req.user.id) throw bad('You cannot change your own role or status.');

    const { role, status, supervisor, manager } = req.body;
    const oldRole = target.role;
    const before = { role: target.role, status: target.status, sickDays: target.sickDays, vacationDays: target.vacationDays };

    if (role !== undefined) {
      if (!ROLES.includes(role)) throw bad('Choose a valid role.');
      target.role = role;
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status)) throw bad('Invalid status.');
      target.status = status;
    }
    if (target.status === 'active' && !target.role) {
      throw bad('Choose a role before approving this account.');
    }

    async function resolveLink(value, requiredRole) {
      if (value === null || value === undefined || value === '') return null;
      if (!mongoose.isValidObjectId(value)) throw bad(`Choose a valid ${requiredRole}.`);
      const person = await User.findOne({ _id: value, status: 'active', role: requiredRole });
      if (!person || person.id === target.id) throw bad(`Choose a valid ${requiredRole}.`);
      return person._id;
    }

    // Employees have a supervisor and a manager; supervisors have a manager.
    if (target.role === 'employee') {
      if (supervisor !== undefined) target.supervisor = await resolveLink(supervisor, 'supervisor');
    } else {
      target.supervisor = null;
    }
    if (target.role === 'employee' || target.role === 'supervisor') {
      if (manager !== undefined) target.manager = await resolveLink(manager, 'manager');
    } else {
      target.manager = null;
    }

    // HR can correct leave balances (whole or half days).
    for (const key of ['sickDays', 'vacationDays']) {
      if (req.body[key] === undefined) continue;
      const n = Number(req.body[key]);
      if (!Number.isFinite(n) || n < 0 || n > 365 || (n * 2) % 1 !== 0) {
        throw bad('Leave days must be between 0 and 365, in steps of 0.5.');
      }
      target[key] = n;
    }

    await target.save();

    // If this person stopped being a supervisor or manager (or was turned off),
    // clear them from the people who pointed at them.
    if (oldRole === 'supervisor' && (target.role !== 'supervisor' || target.status !== 'active')) {
      await User.updateMany({ supervisor: target._id }, { supervisor: null });
    }
    if (oldRole === 'manager' && (target.role !== 'manager' || target.status !== 'active')) {
      await User.updateMany({ manager: target._id }, { manager: null });
    }

    await log(req.user, 'user.update', 'user', target._id, {
      name: target.fullName,
      before,
      after: { role: target.role, status: target.status, sickDays: target.sickDays, vacationDays: target.vacationDays },
    });
    realtime.emitToRoles(['hr'], 'users:changed', {});
    res.json({ user: target.toAdminView() });
  } catch (err) {
    next(err);
  }
});

// HR gives a temporary password to someone who forgot theirs.
// It is shown once and the person must change it at next login.
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw bad('User not found.', 404);
    const target = await User.findById(req.params.id);
    if (!target) throw bad('User not found.', 404);
    if (target.id === req.user.id) throw bad('Use Settings to change your own password.');

    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let temp = '';
    for (let i = 0; i < 10; i++) temp += alphabet[crypto.randomInt(alphabet.length)];

    target.passwordHash = await bcrypt.hash(temp, 10);
    target.mustChangePassword = true;
    await target.save();
    await log(req.user, 'user.reset-password', 'user', target._id, { name: target.fullName });
    res.json({ tempPassword: temp, fullName: target.fullName });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
