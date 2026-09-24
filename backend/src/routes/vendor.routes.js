const express = require('express');
const router = express.Router();
const VendorController = require('../controllers/vendor.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { vendorSchema } = require('../validators/vendor.validator');

router.use(authenticate, resolveBranch);

router.post('/', validate(vendorSchema), VendorController.createVendor);
router.get('/', VendorController.getVendors);
router.get('/:id', VendorController.getVendorById);
router.put('/:id', VendorController.updateVendor);
router.delete('/:id', VendorController.deleteVendor);

router.get('/:id/ledger', VendorController.getVendorLedger);
router.get('/:id/purchases', VendorController.getVendorPurchases);

module.exports = router;
