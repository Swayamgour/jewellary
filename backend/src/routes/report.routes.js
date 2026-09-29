const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/report.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const registry = require('../config/reportRegistry');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

// Excel export (role check happens per report inside the controller)
router.get('/export/excel', ReportController.exportExcelReport);

// Books consistency check (ledger vs balances vs invoices vs purchases)
router.get('/reconciliation', authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT), ReportController.reconciliation);

// One GET route per report in the registry
Object.entries(registry).forEach(([key, def]) => {
  router.get(`/${def.path}`, authorizeRoles(...def.roles), ReportController.json(key));
});

module.exports = router;
