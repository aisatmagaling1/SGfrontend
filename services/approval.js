// The approval rules in one place: who approves, in what order, and whose turn it is.

// Supervisor, then manager, then HR. A step is skipped when the requester has no
// one assigned for it (or is themselves a supervisor or manager).
async function buildSteps(requester) {
  const User = require('../models/User'); // loaded here so the rules below stay easy to test
  const needsSupervisor = requester.role === 'employee';
  const needsManager = requester.role === 'employee' || requester.role === 'supervisor';

  const supervisor = needsSupervisor && requester.supervisor
    ? await User.findOne({ _id: requester.supervisor, status: 'active', role: 'supervisor' })
    : null;
  const manager = needsManager && requester.manager
    ? await User.findOne({ _id: requester.manager, status: 'active', role: 'manager' })
    : null;

  return [
    supervisor
      ? { role: 'supervisor', approver: supervisor._id, approverName: supervisor.fullName, state: 'waiting' }
      : { role: 'supervisor', state: 'skipped' },
    manager
      ? { role: 'manager', approver: manager._id, approverName: manager.fullName, state: 'waiting' }
      : { role: 'manager', state: 'skipped' },
    { role: 'hr', state: 'waiting' },
  ];
}

// Points the request at the first step that is still waiting.
function setCurrent(request) {
  const next = request.steps.find((s) => s.state === 'waiting');
  request.currentRole = next ? next.role : null;
  request.currentApprover = next && next.approver ? next.approver : null;
}

// Only the person whose turn it is can act, and never on their own request.
function canAct(request, user) {
  if (request.status !== 'pending' || !request.currentRole) return false;
  if (String(request.requester) === String(user.id)) return false;
  if (request.currentRole === 'hr') return user.role === 'hr';
  return user.role === request.currentRole && String(request.currentApprover) === String(user.id);
}

const ROLE_LABELS = { supervisor: 'Supervisor', manager: 'Manager', hr: 'HR' };

module.exports = { buildSteps, setCurrent, canAct, ROLE_LABELS };
