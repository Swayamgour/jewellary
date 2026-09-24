const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/report.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.get(
  '/sales',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.ACCOUNTANT),
  ReportController.getSalesReport
);

router.get(
  '/stock',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.INVENTORY_MANAGER),
  ReportController.getStockReport
);

router.get(
  '/customer-outstanding',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.ACCOUNTANT),
  ReportController.getCustomerOutstandingReport
);

router.get(
  '/vendor-outstanding',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.ACCOUNTANT),
  ReportController.getVendorOutstandingReport
);

router.get('/export/excel', ReportController.exportExcelReport);

module.exports = router;
