const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/customer.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { customerSchema, updateCustomerSchema } = require('../validators/customer.validator');

router.use(authenticate, resolveBranch);

router.post('/', validate(customerSchema), CustomerController.createCustomer);
router.get('/', CustomerController.getCustomers);
router.get('/:id', CustomerController.getCustomerById);
router.put('/:id', validate(updateCustomerSchema), CustomerController.updateCustomer);
router.delete('/:id', CustomerController.deleteCustomer);

router.get('/:id/ledger', CustomerController.getCustomerLedger);
router.get('/:id/bills', CustomerController.getCustomerBills);
router.get('/:id/payments', CustomerController.getCustomerPayments);

module.exports = router;
