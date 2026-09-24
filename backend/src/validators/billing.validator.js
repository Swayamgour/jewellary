const Joi = require('joi');
const { MAKING_CHARGE_TYPES, PAYMENT_MODES } = require('../config/constants');

const billingItemSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  barcode: Joi.string().allow('', null),
  productName: Joi.string().required(),
  category: Joi.string().allow('', null),
  hsnCode: Joi.string().default('7113'),
  metal: Joi.string().default('GOLD'),
  purity: Joi.string().default('22K'),
  grossWeight: Joi.number().positive().required(),
  stoneWeight: Joi.number().min(0).default(0),
  quantity: Joi.number().integer().min(1).default(1),
  goldRate: Joi.number().positive().required(),
  makingType: Joi.string().valid(...Object.values(MAKING_CHARGE_TYPES)).default(MAKING_CHARGE_TYPES.PER_GRAM),
  makingRate: Joi.number().min(0).default(0),
  wastagePercent: Joi.number().min(0).default(0),
  stoneAmount: Joi.number().min(0).default(0),
  discount: Joi.number().min(0).default(0)
});

const checkoutPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMode: Joi.string().valid(...Object.values(PAYMENT_MODES)).required(),
  modeDetails: Joi.object({
    transactionId: Joi.string().allow(''),
    upiId: Joi.string().allow(''),
    cardLast4: Joi.string().allow(''),
    bankName: Joi.string().allow('')
  }).optional()
});

const createInvoiceSchema = Joi.object({
  customerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(), // Handled by branch middleware if omitted
  items: Joi.array().items(billingItemSchema).min(1).required(),
  discount: Joi.number().min(0).default(0),
  payments: Joi.array().items(checkoutPaymentSchema).optional(),
  notes: Joi.string().allow('', null)
});

const cancelInvoiceSchema = Joi.object({
  reason: Joi.string().min(5).required().messages({
    'string.empty': 'Cancellation reason is mandatory',
    'string.min': 'Cancellation reason must be at least 5 characters'
  })
});

module.exports = {
  createInvoiceSchema,
  cancelInvoiceSchema
};
