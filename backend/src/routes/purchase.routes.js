const express = require('express');
const router = express.Router();
const PurchaseController = require('../controllers/purchase.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const {
  purchaseSchema,
  purchaseUpdateSchema,
  purchaseConfirmSchema,
  purchasePaymentSchema,
  purchaseCancelSchema,
  purchaseReturnSchema
} = require('../validators/purchase.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER),
  validate(purchaseSchema),
  PurchaseController.createPurchase
);

const buyers = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER];

router.get('/returns', PurchaseController.getPurchaseReturns);
router.get('/', PurchaseController.getPurchases);
router.get('/:id', PurchaseController.getPurchaseById);

router.put('/:id', authorizeRoles(...buyers), validate(purchaseUpdateSchema), PurchaseController.updatePurchase);
router.post('/:id/confirm', authorizeRoles(...buyers), validate(purchaseConfirmSchema), PurchaseController.confirmPurchase);
router.post('/:id/cancel', authorizeRoles(...buyers, ROLES.BRANCH_MANAGER), validate(purchaseCancelSchema), PurchaseController.cancelPurchase);
router.post('/:id/payments', authorizeRoles(...buyers, ROLES.ACCOUNTANT), validate(purchasePaymentSchema), PurchaseController.recordPayment);
router.post('/:id/refund', authorizeRoles(...buyers, ROLES.ACCOUNTANT), validate(purchasePaymentSchema), PurchaseController.recordVendorRefund);

router.post(
  '/:id/return',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER),
  validate(purchaseReturnSchema),
  PurchaseController.recordPurchaseReturn
);

module.exports = router;
