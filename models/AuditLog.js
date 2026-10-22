const mongoose = require('mongoose');

// A permanent record of who did what, and when.
const auditSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  action: { type: String, required: true },
  targetType: String,
  targetId: String,
  details: { type: mongoose.Schema.Types.Mixed },
});

const AuditLog = mongoose.model('AuditLog', auditSchema);

// Never lets a logging problem break the action being logged.
async function log(actor, action, targetType, targetId, details) {
  try {
    await AuditLog.create({
      actor: actor && actor._id,
      actorName: actor && actor.fullName,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      details,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = AuditLog;
module.exports.log = log;
