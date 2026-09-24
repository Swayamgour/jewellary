const ApiError = require('../utils/apiError');
const { ROLES } = require('../config/constants');

/**
 * Authorize specific roles
 * @param  {...string} allowedRoles
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roleId) {
      return next(ApiError.unauthorized('User role is not defined'));
    }

    const userRole = req.user.roleId.name || req.user.role;

    if (userRole === ROLES.SUPER_ADMIN) {
      return next(); // Super admin bypasses all role constraints
    }

    if (!allowedRoles.includes(userRole)) {
      return next(
        ApiError.forbidden(
          `Access denied. Role '${userRole}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};

/**
 * Authorize specific permission on a module/resource
 * @param {string} permission - VIEW, CREATE, UPDATE, DELETE, APPROVE, CANCEL, PRINT, EXPORT
 */
const authorizePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roleId) {
      return next(ApiError.unauthorized('User permissions not loaded'));
    }

    const userRole = req.user.roleId.name || req.user.role;
    if (userRole === ROLES.SUPER_ADMIN) {
      return next();
    }

    const permissions = req.user.roleId.permissions || [];
    const hasPermission = permissions.includes(permission) || permissions.includes('*');

    if (!hasPermission) {
      return next(
        ApiError.forbidden(
          `Access denied. Missing required permission: '${permission}'`
        )
      );
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
  authorizePermission
};
