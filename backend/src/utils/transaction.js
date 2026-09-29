const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('./apiError');

let replicaSetSupported = null;
let warned = false;

async function checkReplicaSetSupport() {
  if (replicaSetSupported !== null) return replicaSetSupported;
  try {
    if (!mongoose.connection.db) return false;
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    replicaSetSupported = Boolean(info.setName || info.msg === 'isdbgrid');
  } catch (err) {
    replicaSetSupported = false;
  }
  return replicaSetSupported;
}

/**
 * Runs `callback(session)` atomically.
 *
 *  - Replica set / Atlas : real ACID transaction, automatically retried on transient errors
 *                          (write conflicts between concurrent requests are retried, not lost).
 *  - Standalone mongod   : no transaction is possible. In production (REQUIRE_TRANSACTIONS=true)
 *                          this is refused, because half-posted invoices / ledgers are unacceptable.
 *
 * Pass `{ session }` to join a transaction that the caller already opened (no nesting).
 */
async function withTransaction(callback, options = {}) {
  if (options.session) {
    return callback(options.session);
  }

  const supported = await checkReplicaSetSupport();

  if (!supported) {
    if (env.REQUIRE_TRANSACTIONS) {
      throw new ApiError(
        503,
        'Database transactions are not available (MongoDB replica set required). Refusing to run a money-moving operation without atomicity.',
        'TRANSACTIONS_UNAVAILABLE'
      );
    }
    if (!warned) {
      warned = true;
      console.warn(
        '[Transaction] MongoDB is not a replica set - running WITHOUT transactions. Use a replica set / Atlas in production.'
      );
    }
    return callback(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await callback(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
    );
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
