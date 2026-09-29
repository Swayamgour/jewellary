const ReportService = require('../services/report.service');
const ReconciliationService = require('../services/reconciliation.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const registry = require('../config/reportRegistry');

function paramsFor(def, req) {
  const p = { branchId: req.branchId || req.query.branchId, ...(def.fixed || {}) };
  for (const k of def.params) if (req.query[k] !== undefined) p[k] = req.query[k];
  return p;
}

class ReportController {
  static json(key) {
    const def = registry[key];
    return async (req, res, next) => {
      try {
        const report = await ReportService[def.method](paramsFor(def, req));
        return ApiResponse.success(res, `${key} report generated`, report);
      } catch (error) {
        next(error);
      }
    };
  }

  /** GET /reports/export/excel?reportType=sales|purchase|payments|... (same filters as the JSON report) */
  static async exportExcelReport(req, res, next) {
    try {
      const key = req.query.reportType === 'inventory' ? 'stock' : req.query.reportType || 'sales';
      const def = registry[key];
      if (!def) {
        throw ApiError.badRequest(`Unknown reportType '${key}'. Available: ${Object.keys(registry).join(', ')}`);
      }
      const role = req.user?.roleId?.name || req.user?.role;
      if (role !== 'SUPER_ADMIN' && !def.roles.includes(role)) {
        throw ApiError.forbidden(`Role '${role}' cannot export ${key}`);
      }

      const report = await ReportService[def.method](paramsFor(def, req));
      const rows = key === 'profit-loss' ? [report.summary] : report.data;
      const buffer = await ReportService.exportToExcel(key, def.columns, rows);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${key}_report_${Date.now()}.xlsx`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async reconciliation(req, res, next) {
    try {
      const result = await ReconciliationService.run({ branchId: req.branchId || req.query.branchId, fix: req.query.fix === 'true' });
      return ApiResponse.success(res, result.ok ? 'Books are consistent' : 'Inconsistencies found', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;
