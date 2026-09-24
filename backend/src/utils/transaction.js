const mongoose = require('mongoose');

/**
 * Executes a callback within a MongoDB session/transaction.
 * Gracefully handles standalone MongoDB servers (non-replica set) where transactions are not supported,
 * while utilizing full ACID transactions in replica sets and production clusters.
 *
 * @param {Function} callback - Async function receiving (session) as parameter
 * @returns {Promise<any>} Result of the callback
 */
let isReplicaSetSupported = null;

async function checkReplicaSetSupport() {
  if (isReplicaSetSupported !== null) {
    return isReplicaSetSupported;
  }
  try {
    if (!mongoose.connection.db) {
      return false;
    }
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ hello: 1 });
    isReplicaSetSupported = Boolean(info.setName || info.msg === 'isdbgrid');
  } catch (err) {
    isReplicaSetSupported = false;
  }
  return isReplicaSetSupported;
}

async function withTransaction(callback) {
  const supported = await checkReplicaSetSupport();

  if (!supported) {
    // Standalone MongoDB without replica set: execute sequentially without transaction session
    return await callback(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  withTransaction
};
