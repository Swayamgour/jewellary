const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventory.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { inventoryAdjustmentSchema, inventoryTransferSchema } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.get('/', InventoryController.getInventory);
router.get('/movements', InventoryController.getStockMovements);
router.get('/:id', InventoryController.getInventoryById);

router.post(
  '/adjustment',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER),
  validate(inventoryAdjustmentSchema),
  InventoryController.stockAdjustment
);

router.post(
  '/transfer',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.INVENTORY_MANAGER),
  validate(inventoryTransferSchema),
  InventoryController.stockTransfer
);

module.exports = router;
