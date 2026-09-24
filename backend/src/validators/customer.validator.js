const Joi = require('joi');

const customerSchema = Joi.object({
  name: Joi.string().trim().required(),
  mobile: Joi.string().trim().min(10).max(15).required(),
  email: Joi.string().email().allow('', null),
  address: Joi.object({
    street: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    stateCode: Joi.string().allow('', null).default('07'),
    pincode: Joi.string().allow('', null)
  }).optional(),
  gstin: Joi.string().allow('', null),
  pan: Joi.string().allow('', null),
  openingBalance: Joi.number().default(0),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  notes: Joi.string().allow('', null)
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().trim(),
  mobile: Joi.string().trim().min(10).max(15),
  email: Joi.string().email().allow('', null),
  address: Joi.object({
    street: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    stateCode: Joi.string().allow('', null),
    pincode: Joi.string().allow('', null)
  }).optional(),
  gstin: Joi.string().allow('', null),
  pan: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

module.exports = {
  customerSchema,
  updateCustomerSchema
};
