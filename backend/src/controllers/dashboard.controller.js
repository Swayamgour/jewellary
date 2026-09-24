const DashboardService = require('../services/dashboard.service');
const ApiResponse = require('../utils/apiResponse');

class DashboardController {
  static async getDashboard(req, res, next) {
    try {
      const branchId = req.branchId || req.query.branchId || null;
      const { filter, startDate, endDate } = req.query;

      const metrics = await DashboardService.getDashboardMetrics({
        branchId,
        filter: filter || 'month',
        startDate,
        endDate
      });

      return ApiResponse.success(res, 'Dashboard metrics computed successfully', metrics);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
