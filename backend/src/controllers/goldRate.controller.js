const GoldRate = require('../models/GoldRate');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/auditLogger');
const { AUDIT_ACTIONS } = require('../config/constants');

class GoldRateController {
  static async setGoldRate(req, res, next) {
    try {
      const { metal, purity, rate, notes } = req.body;
      const branchId = req.branchId || req.body.branchId || req.user.branchId;

      // Mark previous rates for this metal, purity and branch as not current
      await GoldRate.updateMany(
        { branchId, metal, purity, isCurrent: true },
        { isCurrent: false }
      );

      const goldRate = new GoldRate({
        metal,
        purity,
        rate,
        branchId,
        isCurrent: true,
        createdBy: req.user._id,
        effectiveDate: new Date(),
        notes
      });

      await goldRate.save();

      await logAudit({
        userId: req.user._id,
        action: AUDIT_ACTIONS.CREATE,
        module: 'GOLD_RATE',
        recordId: goldRate._id,
        newValue: { metal, purity, rate },
        branchId
      });

      return ApiResponse.created(res, 'Gold rate updated successfully', goldRate);
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentRates(req, res, next) {
    try {
      const branchId = req.branchId || req.query.branchId || req.user?.branchId;
      const query = { isCurrent: true };
      if (branchId) query.branchId = branchId;

      const rates = await GoldRate.find(query).sort({ metal: 1, purity: 1 });
      return ApiResponse.success(res, 'Current active bullion rates', rates);
    } catch (error) {
      next(error);
    }
  }

  static async getRateHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = parseInt(req.query.limit || 20, 10);
      const skip = (page - 1) * limit;

      const query = {};
      if (req.branchId) query.branchId = req.branchId;
      if (req.query.metal) query.metal = req.query.metal;
      if (req.query.purity) query.purity = req.query.purity;

      const [rates, total] = await Promise.all([
        GoldRate.find(query).populate('createdBy', 'name').skip(skip).limit(limit).sort({ effectiveDate: -1 }),
        GoldRate.countDocuments(query)
      ]);

      return ApiResponse.success(res, 'Gold rate history fetched', rates, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = GoldRateController;
