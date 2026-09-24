const Joi = require('joi');
const { METALS, PURITIES, MAKING_CHARGE_TYPES } = require('../config/constants');

const productSchema = Joi.object({
  name: Joi.string().trim().required(),
  code: Joi.string().trim().required(),
  sku: Joi.string().trim().optional(),
  categoryId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  metal: Joi.string().valid(...Object.values(METALS)).default(METALS.GOLD),
  purity: Joi.string().valid(...Object.values(PURITIES)).default(PURITIES.GOLD_22K),
  hsnCode: Joi.string().default('7113'),
  description: Joi.string().allow('', null),
  standardGrossWeight: Joi.number().min(0).default(0),
  standardStoneWeight: Joi.number().min(0).default(0),
  standardNetWeight: Joi.number().min(0).default(0),
  makingType: Joi.string().valid(...Object.values(MAKING_CHARGE_TYPES)).default(MAKING_CHARGE_TYPES.PER_GRAM),
  makingRate: Joi.number().min(0).default(0),
  wastagePercent: Joi.number().min(0).default(0)
});

module.exports = {
  productSchema
};
