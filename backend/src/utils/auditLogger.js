const AuditLog = require('../models/AuditLog');

/**
 * Creates an audit log entry
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.action - CREATE, UPDATE, DELETE, CANCEL, CONVERT, etc.
 * @param {string} params.module - INVOICE, PAYMENT, INVENTORY, etc.
 * @param {string|mongoose.Types.ObjectId} params.recordId
 * @param {Object} [params.oldValue]
 * @param {Object} [params.newValue]
 * @param {string} [params.ipAddress]
 * @param {string|mongoose.Types.ObjectId} [params.branchId]
 * @param {Object} [session] - Optional mongoose session
 */
async function logAudit({
  userId,
  action,
  module: modName,
  recordId,
  oldValue = null,
  newValue = null,
  ipAddress = '127.0.0.1',
  branchId = null
}, session = null) {
  try {
    const logData = {
      userId,
      action,
      module: modName,
      recordId,
      oldValue,
      newValue,
      ipAddress,
      branchId,
      timestamp: new Date()
    };

    if (session) {
      await AuditLog.create([logData], { session });
    } else {
      await AuditLog.create(logData);
    }
  } catch (error) {
    // Non-blocking error logging for audit logs so main business transaction is not disrupted
    console.error(`[AuditLog Error] Failed to log action ${action} on ${modName}:`, error.message);
  }
}

module.exports = {
  logAudit
};
