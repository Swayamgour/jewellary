const User = require('../models/User');
const Role = require('../models/Role');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class UserController {
  static async createUser(req, res, next) {
    try {
      const { name, email, phone, password, roleId, branchId } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw ApiError.conflict('A user with this email address already exists');
      }

      const role = await Role.findById(roleId);
      if (!role) {
        throw ApiError.notFound('Role not found');
      }

      const user = new User({
        name,
        email: email.toLowerCase(),
        phone,
        password,
        roleId,
        role: role.name,
        branchId
      });

      await user.save();

      const created = await User.findById(user._id).populate('roleId').populate('branchId');

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'USER',
        recordId: user._id,
        newValue: { email: user.email, role: role.name },
        branchId
      });

      return ApiResponse.created(res, 'User created successfully', created);
    } catch (error) {
      next(error);
    }
  }

  static async getUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };
      if (req.query.branchId) query.branchId = req.query.branchId;
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ];
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .populate('roleId')
          .populate('branchId')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        User.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Users fetched successfully', users, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req, res, next) {
    try {
      const user = await User.findById(req.params.id).populate('roleId').populate('branchId');
      if (!user || user.isDeleted) {
        throw ApiError.notFound('User not found');
      }
      return ApiResponse.success(res, 'User details', user);
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const { name, phone, isActive, roleId, branchId } = req.body;
      const user = await User.findById(req.params.id);
      if (!user || user.isDeleted) {
        throw ApiError.notFound('User not found');
      }

      if (name) user.name = name;
      if (phone !== undefined) user.phone = phone;
      if (isActive !== undefined) user.isActive = isActive;
      if (roleId) {
        const role = await Role.findById(roleId);
        if (role) {
          user.roleId = role._id;
          user.role = role.name;
        }
      }
      if (branchId) user.branchId = branchId;

      await user.save();

      const updated = await User.findById(user._id).populate('roleId').populate('branchId');

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.UPDATE,
        module: 'USER',
        recordId: user._id,
        newValue: req.body,
        branchId: user.branchId
      });

      return ApiResponse.success(res, 'User updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user || user.isDeleted) {
        throw ApiError.notFound('User not found');
      }

      user.isDeleted = true;
      user.isActive = false;
      await user.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.DELETE,
        module: 'USER',
        recordId: user._id,
        branchId: user.branchId
      });

      return ApiResponse.success(res, 'User deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
