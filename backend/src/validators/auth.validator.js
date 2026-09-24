const Joi = require('joi');
const { ROLES } = require('../config/constants');

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Invalid email format'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required'
  })
});

const registerUserSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('', null),
  password: Joi.string().min(6).required(),
  roleId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
});

module.exports = {
  loginSchema,
  registerUserSchema
};
