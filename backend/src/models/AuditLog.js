const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../config/constants');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true
    },
    module: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    recordId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

auditLogSchema.index({ module: 1, recordId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ branchId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
