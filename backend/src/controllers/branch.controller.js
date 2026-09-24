const Branch = require('../models/Branch');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class BranchController {
  static async createBranch(req, res, next) {
    try {
      const { name, code, address, phone, email, gstin, isHeadOffice } = req.body;

      const existing = await Branch.findOne({ code: code.toUpperCase() });
      if (existing) {
        throw ApiError.conflict(`Branch with code '${code}' already exists`);
      }

      const branch = new Branch({
        name,
        code: code.toUpperCase(),
        address,
        phone,
        email,
        gstin,
        isHeadOffice: Boolean(isHeadOffice)
      });

      await branch.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'BRANCH',
        recordId: branch._id,
        newValue: branch.toObject()
      });

      return ApiResponse.created(res, 'Branch created successfully', branch);
    } catch (error) {
      next(error);
    }
  }

  static async getBranches(req, res, next) {
    try {
      const query = { isDeleted: false };
      const branches = await Branch.find(query).sort({ isHeadOffice: -1, name: 1 });
      return ApiResponse.success(res, 'Branches fetched successfully', branches);
    } catch (error) {
      next(error);
    }
  }

  static async getBranchById(req, res, next) {
    try {
      const branch = await Branch.findById(req.params.id);
      if (!branch || branch.isDeleted) {
        throw ApiError.notFound('Branch not found');
      }
      return ApiResponse.success(res, 'Branch details', branch);
    } catch (error) {
      next(error);
    }
  }

  static async updateBranch(req, res, next) {
    try {
      const branch = await Branch.findById(req.params.id);
      if (!branch || branch.isDeleted) {
        throw ApiError.notFound('Branch not found');
      }

      Object.assign(branch, req.body);
      await branch.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.UPDATE,
        module: 'BRANCH',
        recordId: branch._id,
        newValue: req.body
      });

      return ApiResponse.success(res, 'Branch updated successfully', branch);
    } catch (error) {
      next(error);
    }
  }

  static async deleteBranch(req, res, next) {
    try {
      const branch = await Branch.findById(req.params.id);
      if (!branch || branch.isDeleted) {
        throw ApiError.notFound('Branch not found');
      }

      branch.isDeleted = true;
      branch.isActive = false;
      await branch.save();

      return ApiResponse.success(res, 'Branch deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BranchController;
