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
  status: Joi.string().valid('DRAFT', 'CONFIRMED').default('CONFIRMED'),
  notes: Joi.string().allow('', null)
});

const updateDraftSchema = Joi.object({
  customerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  items: Joi.array().items(billingItemSchema).min(1).optional(),
  discount: Joi.number().min(0).optional(),
  notes: Joi.string().allow('', null)
});

const confirmDraftSchema = Joi.object({
  payments: Joi.array().items(checkoutPaymentSchema).optional()
});

const cancelInvoiceSchema = Joi.object({
  reason: Joi.string().min(5).required().messages({
    'string.empty': 'Cancellation reason is mandatory',
    'string.min': 'Cancellation reason must be at least 5 characters'
  }),
  // What happens to money the customer already paid: keep as ledger credit (default) or pay it back
  paymentAction: Joi.string().valid('CREDIT', 'REFUND').default('CREDIT'),
  refundMode: Joi.string().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER').default('CASH'),
  refundModeDetails: Joi.object().unknown(true).optional()
});

const salesReturnSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        invoiceItemId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
        barcode: Joi.string(),
        quantity: Joi.number().integer().min(1).default(1)
      }).or('invoiceItemId', 'barcode')
    )
    .min(1)
    .required(),
  refundType: Joi.string().valid('LEDGER_CREDIT', 'CASH', 'UPI', 'BANK_TRANSFER').default('LEDGER_CREDIT'),
  refundModeDetails: Joi.object().unknown(true).optional(),
  reason: Joi.string().min(3).required()
});

module.exports = {
  createInvoiceSchema,
  updateDraftSchema,
  confirmDraftSchema,
  cancelInvoiceSchema,
  salesReturnSchema
};
