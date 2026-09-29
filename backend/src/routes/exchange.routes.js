const express = require('express');
const router = express.Router();
const ExchangeController = require('../controllers/exchange.controller');
const authenticate = require('../middleware/auth.middleware');
const resolveBranch = require('../middleware/branch.middleware');
const validate = require('../middleware/validate.middleware');
const Joi = require('joi');
const { exchangeSchema } = require('../validators/inventory.validator');
const { PAYMENT_MODES } = require('../config/constants');

const adjustSchema = Joi.object({
  invoiceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  amount: Joi.number().positive().optional()
});
const payoutSchema = Joi.object({
  amount: Joi.number().positive().optional(),
  paymentMode: Joi.string().valid(...Object.values(PAYMENT_MODES).filter((m) => m !== 'EXCHANGE')).required(),
  modeDetails: Joi.object().unknown(true).optional()
});

router.use(authenticate, resolveBranch);

router.post('/', validate(exchangeSchema), ExchangeController.createExchange);
router.get('/', ExchangeController.getExchanges);
router.get('/:id', ExchangeController.getExchangeById);
router.post('/:id/adjust', validate(adjustSchema), ExchangeController.adjust);
router.post('/:id/payout', validate(payoutSchema), ExchangeController.payout);

module.exports = router;
