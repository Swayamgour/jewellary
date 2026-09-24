const express = require('express');
const router = express.Router();
const PurchaseController = require('../controllers/purchase.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { purchaseSchema, purchaseReturnSchema } = require('../validators/purchase.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER),
  validate(purchaseSchema),
  PurchaseController.createPurchase
);

router.get('/', PurchaseController.getPurchases);
router.get('/:id', PurchaseController.getPurchaseById);

router.post(
  '/:id/return',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER),
  validate(purchaseReturnSchema),
  PurchaseController.recordPurchaseReturn
);

module.exports = router;
