const ApiError = require('../utils/apiError');
const { ROLES } = require('../config/constants');

/**
 * Middleware to enforce multi-branch scoping
 * Sets req.branchId and verifies branch access
 */
const resolveBranch = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }

  const userRole = req.user.roleId?.name || req.user.role;
  const requestedBranch = req.headers['x-branch-id'] || req.query.branchId || req.body.branchId;

  if (userRole === ROLES.SUPER_ADMIN) {
    // Super admin can specify any branch or leave it null for all branches
    req.branchId = requestedBranch || req.user.branchId?._id || req.user.branchId;
    return next();
  }

  // Regular users are strictly scoped to their assigned branch
  const assignedBranch = req.user.branchId?._id || req.user.branchId;

  if (!assignedBranch) {
    return next(ApiError.forbidden('User has no assigned branch'));
  }

  if (requestedBranch && requestedBranch.toString() !== assignedBranch.toString()) {
    return next(ApiError.forbidden('You are not authorized to access or modify data for another branch'));
  }

  req.branchId = assignedBranch;
  next();
};

module.exports = resolveBranch;
