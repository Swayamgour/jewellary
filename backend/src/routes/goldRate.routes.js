const express = require('express');
const router = express.Router();
const GoldRateController = require('../controllers/goldRate.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { goldRateSchema } = require('../validators/inventory.validator');
const { ROLES } = require('../config/constants');

router.use(authenticate, resolveBranch);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER),
  validate(goldRateSchema),
  GoldRateController.setGoldRate
);
router.get('/current', GoldRateController.getCurrentRates);
router.get('/', GoldRateController.getRateHistory);

module.exports = router;
