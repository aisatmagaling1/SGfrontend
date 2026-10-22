const mongoose = require('mongoose');
const { YEARLY_LEAVE_DAYS } = require('../config/constants');

const ROLES = ['employee', 'supervisor', 'manager', 'hr', 'accounting'];
const STATUSES = ['pending', 'active', 'disabled'];

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // null until HR approves the account and assigns a role
    role: { type: String, enum: [...ROLES, null], default: null },
    status: { type: String, enum: STATUSES, default: 'pending' },
    // HR assigns these: employees have a supervisor and a manager,
    // supervisors have a manager.
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    mustChangePassword: { type: Boolean, default: false },
    // Leave days left. Sick and Vacation start at the yearly amount; HR can edit them.
    sickDays: { type: Number, default: YEARLY_LEAVE_DAYS, min: 0 },
    vacationDays: { type: Number, default: YEARLY_LEAVE_DAYS, min: 0 },
    balanceYear: { type: Number, default: () => new Date().getFullYear() },
  },
  { timestamps: true }
);

userSchema.methods.toSession = function () {
  return {
    id: this.id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    mustChangePassword: this.mustChangePassword,
    sickDays: this.sickDays,
    vacationDays: this.vacationDays,
  };
};

userSchema.methods.toAdminView = function () {
  return {
    id: this.id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    status: this.status,
    supervisor: this.supervisor ? String(this.supervisor) : null,
    manager: this.manager ? String(this.manager) : null,
    sickDays: this.sickDays,
    vacationDays: this.vacationDays,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.STATUSES = STATUSES;
