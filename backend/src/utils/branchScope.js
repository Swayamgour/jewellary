const ApiError = require('./apiError');
const { ROLES } = require('../config/constants');

/**
 * Prevents a branch-scoped user from reading / mutating a document that belongs to another branch
 * just by knowing its id. SUPER_ADMIN may access every branch.
 */
function assertBranchAccess(req, doc) {
  if (!doc) return;
  const role = req.user?.roleId?.name || req.user?.role;
  if (role === ROLES.SUPER_ADMIN) return;
  const docBranch = doc.branchId?._id || doc.branchId;
  if (!docBranch) return;
  const userBranch = req.branchId || req.user?.branchId?._id || req.user?.branchId;
  if (userBranch && docBranch.toString() !== userBranch.toString()) {
    throw ApiError.forbidden('This record belongs to another branch');
  }
}

module.exports = { assertBranchAccess };

/**
 * Loads only the branchId of a document and applies assertBranchAccess.
 * Call this before running a service that mutates a document identified by :id.
 */
async function guardBranch(req, Model, id, label = 'Record') {
  const doc = await Model.findById(id).select('branchId');
  if (!doc) throw ApiError.notFound(`${label} not found`);
  assertBranchAccess(req, doc);
  return doc;
}

module.exports.guardBranch = guardBranch;
