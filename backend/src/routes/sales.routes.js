const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/sales.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.get('/', SalesController.getSales);
router.get('/:id', SalesController.getSaleById);
router.post(
  '/:id/return',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.SALES_MANAGER),
  SalesController.recordSalesReturn
);

module.exports = router;
