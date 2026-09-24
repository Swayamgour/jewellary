const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const env = require('../config/env');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false })
        .select('+password')
        .populate('roleId')
        .populate('branchId');

      if (!user) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      if (!user.isActive) {
        throw ApiError.forbidden('Your account is inactive. Please contact your manager');
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        {
          id: user._id,
          role: user.roleId?.name || user.role,
          branchId: user.branchId?._id
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      const userObj = user.toJSON();

      await logAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'AUTH_LOGIN',
        recordId: user._id,
        ipAddress: req.ip,
        branchId: user.branchId?._id
      });

      return ApiResponse.success(res, 'Logged in successfully', {
        token,
        user: userObj
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user._id)
        .populate('roleId')
        .populate('branchId')
        .select('-password');

      return ApiResponse.success(res, 'Current user profile', user);
    } catch (error) {
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      return ApiResponse.success(res, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
