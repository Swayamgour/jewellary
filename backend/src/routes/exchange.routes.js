const express = require('express');
const router = express.Router();
const ExchangeController = require('../controllers/exchange.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const { exchangeSchema } = require('../validators/inventory.validator');

router.use(authenticate, resolveBranch);

router.post('/', validate(exchangeSchema), ExchangeController.createExchange);
router.get('/', ExchangeController.getExchanges);
router.get('/:id', ExchangeController.getExchangeById);

module.exports = router;
