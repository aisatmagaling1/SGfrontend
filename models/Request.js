const mongoose = require('mongoose');
const { Schema } = mongoose;

const stepSchema = new Schema(
  {
    role: { type: String, enum: ['supervisor', 'manager', 'hr'], required: true },
    approver: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null for HR (any HR)
    approverName: String,
    state: {
      type: String,
      enum: ['waiting', 'approved', 'rejected', 'skipped', 'closed'],
      default: 'waiting',
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedByName: String,
    decidedAt: Date,
    remarks: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const timelineSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    action: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    note: String,
  },
  { _id: false }
);

const requestSchema = new Schema(
  {
    refNo: { type: String, unique: true, index: true },
    formType: { type: String, required: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterName: String,
    data: { type: Schema.Types.Mixed, required: true },
    computed: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    steps: [stepSchema],
    // Who must act now (kept on the request so queues are one simple query)
    currentRole: { type: String, default: null },
    currentApprover: { type: Schema.Types.ObjectId, default: null },
    timeline: [timelineSchema],
  },
  { timestamps: true, optimisticConcurrency: true, minimize: false }
);

requestSchema.index({ status: 1, currentRole: 1, currentApprover: 1 });

module.exports = mongoose.model('Request', requestSchema);
