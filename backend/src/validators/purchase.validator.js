const Joi = require('joi');
const { METALS, PURITIES } = require('../config/constants');

const purchaseItemSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  productName: Joi.string().required(),
  categoryId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  barcode: Joi.string().allow('', null),
  metal: Joi.string().valid(...Object.values(METALS)).default(METALS.GOLD),
  purity: Joi.string().valid(...Object.values(PURITIES)).default(PURITIES.GOLD_22K),
  grossWeight: Joi.number().positive().required(),
  stoneWeight: Joi.number().min(0).default(0),
  quantity: Joi.number().integer().min(1).default(1),
  rate: Joi.number().positive().required(),
  makingAmount: Joi.number().min(0).default(0),
  otherCharges: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0)
});

const purchaseSchema = Joi.object({
  vendorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  vendorInvoiceNo: Joi.string().allow('', null),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  purchaseDate: Joi.date().default(Date.now),
  items: Joi.array().items(purchaseItemSchema).min(1).required(),
  taxAmount: Joi.number().min(0).default(0),
  paidAmount: Joi.number().min(0).default(0),
  paymentMode: Joi.string().default('BANK_TRANSFER'),
  notes: Joi.string().allow('', null)
});

const purchaseReturnSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      barcode: Joi.string().required(),
      productName: Joi.string().required(),
      metal: Joi.string().required(),
      purity: Joi.string().required(),
      grossWeight: Joi.number().required(),
      netWeight: Joi.number().required(),
      quantity: Joi.number().default(1),
      rate: Joi.number().required(),
      amount: Joi.number().required()
    })
  ).min(1).required(),
  reason: Joi.string().required()
});

module.exports = {
  purchaseSchema,
  purchaseReturnSchema
};
