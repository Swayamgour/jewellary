const ApiError = require('../utils/apiError');

/**
 * Validates request data against a Joi schema
 * @param {Object} schema - Joi schema
 * @param {string} property - 'body', 'query', or 'params'
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, '')
      }));

      return next(ApiError.unprocessableEntity('Input validation failed', 'VALIDATION_ERROR', details));
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
