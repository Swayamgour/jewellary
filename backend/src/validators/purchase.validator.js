const Joi = require('joi');
const { METALS, PURITIES, PAYMENT_MODES } = require('../config/constants');

const oid = () => Joi.string().regex(/^[0-9a-fA-F]{24}$/);
const modeDetails = Joi.object().unknown(true).optional();
const payMode = Joi.string().valid(...Object.values(PAYMENT_MODES).filter((m) => m !== 'EXCHANGE'));

// Weights are PER UNIT. rate = per gram. makingAmount / otherCharges / taxAmount = for the whole line.
const purchaseItemSchema = Joi.object({
  productId: oid().required(), // every purchased piece becomes a stock row, which belongs to a product design
  productName: Joi.string().required(),
  categoryId: oid().optional(),
  barcode: Joi.string().allow('', null),
  metal: Joi.string().valid(...Object.values(METALS)).default(METALS.GOLD),
  purity: Joi.string().valid(...Object.values(PURITIES)).default(PURITIES.GOLD_22K),
  grossWeight: Joi.number().positive().required(),
  stoneWeight: Joi.number().min(0).default(0),
  quantity: Joi.number().integer().min(1).default(1),
  rate: Joi.number().positive().required(),
  makingAmount: Joi.number().min(0).default(0),
  otherCharges: Joi.number().min(0).default(0),
  gstRate: Joi.number().min(0).max(28).default(0),
  taxAmount: Joi.number().min(0).default(0)
});

const purchaseSchema = Joi.object({
  vendorId: oid().required(),
  vendorInvoiceNo: Joi.string().allow('', null),
  branchId: oid().optional(),
  purchaseDate: Joi.date().default(Date.now),
  items: Joi.array().items(purchaseItemSchema).min(1).required(),
  taxAmount: Joi.number().min(0).default(0), // legacy: single tax figure for the bill
  status: Joi.string().valid('DRAFT', 'COMPLETED').default('COMPLETED'),
  paidAmount: Joi.number().min(0).default(0),
  paymentMode: payMode.default('BANK_TRANSFER'),
  modeDetails,
  notes: Joi.string().allow('', null)
});

const purchaseUpdateSchema = Joi.object({
  vendorId: oid().optional(),
  vendorInvoiceNo: Joi.string().allow('', null),
  purchaseDate: Joi.date().optional(),
  items: Joi.array().items(purchaseItemSchema).min(1).optional(),
  taxAmount: Joi.number().min(0).optional(),
  notes: Joi.string().allow('', null)
});

const purchaseConfirmSchema = Joi.object({
  paidAmount: Joi.number().min(0).default(0),
  paymentMode: payMode.default('BANK_TRANSFER'),
  modeDetails
});

const purchasePaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMode: payMode.required(),
  modeDetails,
  notes: Joi.string().allow('', null)
});

const purchaseCancelSchema = Joi.object({
  reason: Joi.string().min(5).required(),
  paymentAction: Joi.string().valid('CREDIT', 'REFUND').default('CREDIT'),
  refundMode: payMode.default('BANK_TRANSFER'),
  refundModeDetails: modeDetails
});

// The value of a return is computed by the server from the purchase line - clients only say WHAT and HOW MANY
const purchaseReturnSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        purchaseItemId: oid(),
        barcode: Joi.string(),
        quantity: Joi.number().integer().min(1).default(1)
      }).or('purchaseItemId', 'barcode')
    )
    .min(1)
    .required(),
  reason: Joi.string().min(3).required()
});

// ---------------------------------------------------------------- purchase orders
const poItemSchema = Joi.object({
  productId: oid().required(),
  categoryId: oid().optional(),
  productName: Joi.string().required(),
  metal: Joi.string().valid(...Object.values(METALS)).default(METALS.GOLD),
  purity: Joi.string().valid(...Object.values(PURITIES)).default(PURITIES.GOLD_22K),
  grossWeight: Joi.number().positive().required(),
  stoneWeight: Joi.number().min(0).default(0),
  quantity: Joi.number().integer().min(1).required(),
  rate: Joi.number().positive().required(),
  makingAmount: Joi.number().min(0).default(0),
  otherCharges: Joi.number().min(0).default(0),
  gstRate: Joi.number().min(0).max(28).default(0)
});

const purchaseOrderSchema = Joi.object({
  vendorId: oid().required(),
  branchId: oid().optional(),
  expectedDeliveryDate: Joi.date().optional(),
  items: Joi.array().items(poItemSchema).min(1).required(),
  notes: Joi.string().allow('', null)
});

const purchaseOrderUpdateSchema = Joi.object({
  vendorId: oid().optional(),
  expectedDeliveryDate: Joi.date().optional(),
  items: Joi.array().items(poItemSchema).min(1).optional(),
  notes: Joi.string().allow('', null)
});

const poNoteSchema = Joi.object({ note: Joi.string().allow('', null) });
const poReasonSchema = Joi.object({ reason: Joi.string().min(3).required() });
const poCloseSchema = Joi.object({ reason: Joi.string().allow('', null) });

const poReceiveSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        poItemId: oid().required(),
        quantity: Joi.number().integer().min(1).required(),
        barcode: Joi.string().allow('', null),
        grossWeight: Joi.number().positive().optional(),
        stoneWeight: Joi.number().min(0).optional(),
        rate: Joi.number().positive().optional(),
        makingAmount: Joi.number().min(0).optional(),
        otherCharges: Joi.number().min(0).optional(),
        gstRate: Joi.number().min(0).max(28).optional()
      })
    )
    .min(1)
    .required(),
  vendorInvoiceNo: Joi.string().allow('', null),
  purchaseDate: Joi.date().optional(),
  paidAmount: Joi.number().min(0).default(0),
  paymentMode: payMode.default('BANK_TRANSFER'),
  modeDetails,
  notes: Joi.string().allow('', null)
});

module.exports = {
  purchaseSchema,
  purchaseUpdateSchema,
  purchaseConfirmSchema,
  purchasePaymentSchema,
  purchaseCancelSchema,
  purchaseReturnSchema,
  purchaseOrderSchema,
  purchaseOrderUpdateSchema,
  poNoteSchema,
  poReasonSchema,
  poCloseSchema,
  poReceiveSchema
};
