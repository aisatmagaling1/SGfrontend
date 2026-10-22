const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Request = require('../models/Request');
const User = require('../models/User');
const { log } = require('../models/AuditLog');
const forms = require('../public/js/forms.js');
const { buildSteps, setCurrent, canAct, ROLE_LABELS } = require('../services/approval');
const realtime = require('../services/realtime');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const FILERS = ['employee', 'supervisor', 'manager', 'hr'];
const LEAVE_KEYS = { sick: 'sickDays', vacation: 'vacationDays' };
const LEAVE_NAMES = { sick: 'Sick', vacation: 'Vacation' };
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

function refNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `RH-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function view(r, user) {
  const o = r.toObject ? r.toObject() : r;
  return {
    id: String(o._id),
    refNo: o.refNo,
    formType: o.formType,
    label: (forms.FORMS[o.formType] || {}).label || o.formType,
    requester: { id: String(o.requester), name: o.requesterName },
    data: o.data,
    computed: o.computed || {},
    summary: forms.summary(o.formType, o.data, o.computed),
    status: o.status,
    steps: o.steps.map((s) => ({
      role: s.role,
      approverName: s.approverName || null,
      state: s.state,
      decidedByName: s.decidedByName || null,
      decidedAt: s.decidedAt || null,
      remarks: s.remarks || '',
    })),
    currentRole: o.currentRole,
    timeline: o.timeline,
    createdAt: o.createdAt,
    canAct: canAct(o, user),
    canCancel: String(o.requester) === user.id && o.status === 'pending',
  };
}

// Tells everyone affected that this request changed. They then reload it from the API.
function announce(r) {
  const people = [r.requester, ...r.steps.map((s) => s.approver)];
  realtime.emitToUsers(people, 'request:changed', { id: String(r._id), status: r.status });
  realtime.emitToRoles(['hr', 'accounting'], 'request:changed', { id: String(r._id), status: r.status });
}

async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw bad('Request not found.', 404);
  const r = await Request.findById(id);
  if (!r) throw bad('Request not found.', 404);
  return r;
}

const list = (docs, user) => docs.map((d) => view(d, user));

router.post('/', requireRole(...FILERS), async (req, res, next) => {
  try {
    const { formType, data } = req.body || {};
    if (!forms.FORMS[formType]) throw bad('Choose a form.');
    const { errors, clean, computed } = forms.validate(formType, data);
    const firstError = Object.values(errors)[0];
    if (firstError) throw bad(firstError);

    // Sick and Vacation leave need enough days left (counting leave already waiting for approval).
    if (formType === 'leave' && LEAVE_KEYS[clean.leaveType]) {
      const waiting = await Request.find(
        { requester: req.user._id, formType: 'leave', status: 'pending', 'data.leaveType': clean.leaveType },
        'computed'
      );
      const reserved = waiting.reduce((sum, r) => sum + ((r.computed && r.computed.days) || 0), 0);
      const available = (req.user[LEAVE_KEYS[clean.leaveType]] || 0) - reserved;
      if (computed.days > available) {
        throw bad(`Not enough ${LEAVE_NAMES[clean.leaveType].toLowerCase()} leave. You have ${available} day(s) available` +
          (reserved ? ` (${reserved} already waiting for approval).` : '.'));
      }
    }

    const doc = new Request({
      refNo: refNo(),
      formType,
      requester: req.user._id,
      requesterName: req.user.fullName,
      data: clean,
      computed,
      steps: await buildSteps(req.user),
      timeline: [{ action: 'Submitted', by: req.user._id, byName: req.user.fullName }],
    });
    setCurrent(doc);
    await doc.save();

    await log(req.user, 'request.submit', 'request', doc._id, { refNo: doc.refNo, formType });
    announce(doc);
    res.status(201).json({ request: view(doc, req.user) });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', async (req, res, next) => {
  try {
    const docs = await Request.find({ requester: req.user._id }).sort({ createdAt: -1 }).limit(200);
    res.json({ requests: list(docs, req.user) });
  } catch (err) { next(err); }
});

// Requests waiting for this person to approve or reject.
router.get('/queue', requireRole('supervisor', 'manager', 'hr'), async (req, res, next) => {
  try {
    const filter = req.user.role === 'hr'
      ? { status: 'pending', currentRole: 'hr', requester: { $ne: req.user._id } }
      : { status: 'pending', currentRole: req.user.role, currentApprover: req.user._id };
    const docs = await Request.find(filter).sort({ createdAt: 1 }).limit(200);
    res.json({ requests: list(docs, req.user) });
  } catch (err) { next(err); }
});

router.get('/all', requireRole('hr', 'accounting'), async (req, res, next) => {
  try {
    const docs = await Request.find().sort({ createdAt: -1 }).limit(300);
    res.json({ requests: list(docs, req.user) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await load(req.params.id);
    const uid = req.user.id;
    const involved = String(r.requester) === uid
      || ['hr', 'accounting'].includes(req.user.role)
      || r.steps.some((s) => (s.approver && String(s.approver) === uid) || (s.decidedBy && String(s.decidedBy) === uid));
    if (!involved) throw bad('Request not found.', 404);
    res.json({ request: view(r, req.user) });
  } catch (err) { next(err); }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    const r = await load(req.params.id);
    if (!canAct(r, req.user)) throw bad('This request is not waiting for you.', 403);
    const remarks = String(req.body.remarks || '').trim().slice(0, 500);

    const step = r.steps.find((s) => s.state === 'waiting');
    step.state = 'approved';
    step.decidedBy = req.user._id;
    step.decidedByName = req.user.fullName;
    step.decidedAt = new Date();
    step.remarks = remarks;
    r.timeline.push({
      action: `Approved by ${ROLE_LABELS[step.role]}`, by: req.user._id, byName: req.user.fullName, note: remarks || undefined,
    });
    setCurrent(r);

    // Final approval of Sick or Vacation leave takes the days off the balance.
    let refund = null;
    if (!r.currentRole) {
      r.status = 'approved';
      const type = r.data.leaveType;
      if (r.formType === 'leave' && LEAVE_KEYS[type]) {
        const key = LEAVE_KEYS[type];
        const days = r.computed.days;
        const updated = await User.findOneAndUpdate({ _id: r.requester, [key]: { $gte: days } }, { $inc: { [key]: -days } });
        if (!updated) {
          throw bad(`${r.requesterName} does not have enough ${LEAVE_NAMES[type].toLowerCase()} leave left. ` +
            'Update their balance on the Users page, then approve again.');
        }
        refund = { id: r.requester, key, days };
      }
    }
    try {
      await r.save();
    } catch (err) {
      if (refund) await User.updateOne({ _id: refund.id }, { $inc: { [refund.key]: refund.days } });
      throw err;
    }

    await log(req.user, 'request.approve', 'request', r._id, { refNo: r.refNo, step: step.role, remarks });
    announce(r);
    if (refund) realtime.emitToRoles(['hr'], 'users:changed', {});
    res.json({ request: view(r, req.user) });
  } catch (err) { next(err); }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    const r = await load(req.params.id);
    if (!canAct(r, req.user)) throw bad('This request is not waiting for you.', 403);
    const remarks = String(req.body.remarks || '').trim().slice(0, 500);
    if (!remarks) throw bad('Write a reason for rejecting this request.');

    const step = r.steps.find((s) => s.state === 'waiting');
    step.state = 'rejected';
    step.decidedBy = req.user._id;
    step.decidedByName = req.user.fullName;
    step.decidedAt = new Date();
    step.remarks = remarks;
    r.steps.forEach((s) => { if (s.state === 'waiting') s.state = 'closed'; });
    r.status = 'rejected';
    r.timeline.push({
      action: `Rejected by ${ROLE_LABELS[step.role]}`, by: req.user._id, byName: req.user.fullName, note: remarks,
    });
    setCurrent(r);
    await r.save();

    await log(req.user, 'request.reject', 'request', r._id, { refNo: r.refNo, step: step.role, remarks });
    announce(r);
    res.json({ request: view(r, req.user) });
  } catch (err) { next(err); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const r = await load(req.params.id);
    if (String(r.requester) !== req.user.id) throw bad('Only the person who filed this request can cancel it.', 403);
    if (r.status !== 'pending') throw bad('Only a pending request can be cancelled.');

    r.steps.forEach((s) => { if (s.state === 'waiting') s.state = 'closed'; });
    r.status = 'cancelled';
    r.timeline.push({ action: 'Cancelled by requester', by: req.user._id, byName: req.user.fullName });
    setCurrent(r);
    await r.save();

    await log(req.user, 'request.cancel', 'request', r._id, { refNo: r.refNo });
    announce(r);
    res.json({ request: view(r, req.user) });
  } catch (err) { next(err); }
});

module.exports = router;
