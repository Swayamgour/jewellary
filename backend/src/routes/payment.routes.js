const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/payment.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { paymentSchema, reversePaymentSchema } = require('../validators/payment.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.post('/', validate(paymentSchema), PaymentController.recordPayment);
router.get('/', PaymentController.getPayments);
router.get('/:id', PaymentController.getPaymentById);
router.post(
  '/:id/reverse',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.ACCOUNTANT),
  validate(reversePaymentSchema),
  PaymentController.reversePayment
);

module.exports = router;
