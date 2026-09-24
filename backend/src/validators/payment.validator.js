const Joi = require('joi');
const { PAYMENT_MODES } = require('../config/constants');

const paymentSchema = Joi.object({
  referenceType: Joi.string().valid('INVOICE', 'PURCHASE', 'ORDER', 'ADVANCE', 'DIRECT').required(),
  referenceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null, '').optional(),
  entityType: Joi.string().valid('CUSTOMER', 'VENDOR').required(),
  entityId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  amount: Joi.number().positive().required(),
  paymentMode: Joi.string().valid(...Object.values(PAYMENT_MODES)).required(),
  modeDetails: Joi.object({
    transactionId: Joi.string().allow('', null),
    upiId: Joi.string().allow('', null),
    cardLast4: Joi.string().allow('', null),
    bankName: Joi.string().allow('', null),
    chequeNo: Joi.string().allow('', null),
    chequeDate: Joi.date().allow(null)
  }).optional(),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  notes: Joi.string().allow('', null)
});

const reversePaymentSchema = Joi.object({
  reversalReason: Joi.string().min(5).required()
});

module.exports = {
  paymentSchema,
  reversePaymentSchema
};
