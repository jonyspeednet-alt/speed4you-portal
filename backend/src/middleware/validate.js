const Joi = require('joi');

function validateQuery(schema) {
  return (req, res, next) => {
    const { value, error } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.details.map((detail) => detail.message),
      });
    }

    req.validatedQuery = value;
    return next();
  };
}

module.exports = {
  Joi,
  validateQuery,
};
