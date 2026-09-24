const Joi = require('joi');
const { METALS, PURITIES } = require('../config/constants');

const inventoryAdjustmentSchema = Joi.object({
  barcode: Joi.string().required(),
  adjustmentType: Joi.string().valid('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'LOSS').required(),
  quantityDelta: Joi.number().integer().required(),
  weightDelta: Joi.number().optional(),
  reason: Joi.string().min(3).required()
});

const inventoryTransferSchema = Joi.object({
  barcode: Joi.string().required(),
  targetBranchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  reason: Joi.string().allow('', null)
});

const exchangeSchema = Joi.object({
  customerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  invoiceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null, '').optional(),
  items: Joi.array().items(
    Joi.object({
      itemDescription: Joi.string().required(),
      metal: Joi.string().valid(...Object.values(METALS)).default(METALS.GOLD),
      purityDeclared: Joi.string().default('22K'),
      testingMethod: Joi.string().valid('TOUCHSTONE', 'ACID', 'XRF_SPECTROMETER', 'DENSITY').default('TOUCHSTONE'),
      purityTestedPercent: Joi.number().positive().max(100).required(),
      grossWeight: Joi.number().positive().required(),
      stoneWeight: Joi.number().min(0).default(0),
      meltingLossPercent: Joi.number().min(0).max(50).default(0),
      goldRateApplied: Joi.number().positive().required()
    })
  ).min(1).required(),
  notes: Joi.string().allow('', null)
});

const goldRateSchema = Joi.object({
  metal: Joi.string().valid(...Object.values(METALS)).required(),
  purity: Joi.string().valid(...Object.values(PURITIES)).required(),
  rate: Joi.number().positive().required(),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  notes: Joi.string().allow('', null)
});

const expenseSchema = Joi.object({
  title: Joi.string().trim().required(),
  category: Joi.string().trim().required(),
  amount: Joi.number().positive().required(),
  paymentMode: Joi.string().default('CASH'),
  paymentReference: Joi.string().allow('', null),
  expenseDate: Joi.date().default(Date.now),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  notes: Joi.string().allow('', null)
});

const orderSchema = Joi.object({
  customerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  expectedDeliveryDate: Joi.date().greater('now').required(),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  items: Joi.array().items(
    Joi.object({
      designName: Joi.string().required(),
      categoryId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      metal: Joi.string().default('GOLD'),
      purity: Joi.string().default('22K'),
      estimatedGrossWeight: Joi.number().positive().required(),
      estimatedNetWeight: Joi.number().positive().required(),
      goldRateLocked: Joi.number().min(0).default(0),
      estimatedMakingRate: Joi.number().min(0).default(0),
      estimatedTotalAmount: Joi.number().positive().required(),
      specialInstructions: Joi.string().allow('', null)
    })
  ).min(1).required(),
  totalEstimatedAmount: Joi.number().positive().required(),
  advancePaid: Joi.number().min(0).default(0),
  notes: Joi.string().allow('', null)
});

module.exports = {
  inventoryAdjustmentSchema,
  inventoryTransferSchema,
  exchangeSchema,
  goldRateSchema,
  expenseSchema,
  orderSchema
};
