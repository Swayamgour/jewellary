const Joi = require('joi');

const vendorSchema = Joi.object({
  name: Joi.string().trim().required(),
  company: Joi.string().trim().required(),
  mobile: Joi.string().trim().min(10).max(15).required(),
  email: Joi.string().email().allow('', null),
  gstin: Joi.string().allow('', null),
  pan: Joi.string().allow('', null),
  address: Joi.object({
    street: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    state: Joi.string().allow('', null),
    stateCode: Joi.string().allow('', null).default('07'),
    pincode: Joi.string().allow('', null)
  }).optional(),
  bankDetails: Joi.object({
    bankName: Joi.string().allow('', null),
    accountNo: Joi.string().allow('', null),
    ifsc: Joi.string().allow('', null),
    branch: Joi.string().allow('', null)
  }).optional(),
  openingBalance: Joi.number().default(0),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  notes: Joi.string().allow('', null)
});

module.exports = {
  vendorSchema
};
