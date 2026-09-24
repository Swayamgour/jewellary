const express = require('express');
const router = express.Router();
const BillingController = require('../controllers/billing.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles, authorizePermission } = require('../middleware/role.middleware');
const { createInvoiceSchema, cancelInvoiceSchema } = require('../validators/billing.validator');
const { ROLES, PERMISSIONS } = require('../config/constants');

router.use(authenticate, resolveBranch);

// Kacha Bills
router.post('/kacha', validate(createInvoiceSchema), BillingController.createKachaBill);
router.get('/kacha', BillingController.getKachaBills);
router.get('/kacha/:id', BillingController.getKachaBillById);
router.post(
  '/kacha/:id/convert',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.SALES_MANAGER),
  BillingController.convertKachaToPakka
);

// Pakka / GST Invoices
router.post('/pakka', validate(createInvoiceSchema), BillingController.createPakkaBill);
router.get('/pakka', BillingController.getPakkaBills);
router.get('/pakka/:id', BillingController.getPakkaBillById);
router.post(
  '/pakka/:id/cancel',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  authorizePermission(PERMISSIONS.CANCEL),
  validate(cancelInvoiceSchema),
  BillingController.cancelInvoice
);

module.exports = router;
