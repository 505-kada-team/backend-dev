const Joi = require('joi');

const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" is invalid. It must be a valid MongoDB ObjectId');
  }
  return value;
};

const saleItem = Joi.object({
  menuId: Joi.string().custom(objectId).required(),
  quantitySold: Joi.number().integer().positive().required().messages({
    'number.positive': 'quantitySold must be greater than 0',
    'number.integer': 'quantitySold must be an integer',
    'any.required': 'quantitySold is required',
  }),
});

const createSales = {
  body: Joi.object().keys({
    items: Joi.array()
      .items(saleItem)
      .min(1)
      .required()
      .custom((items, helpers) => {
        const menuIds = items.map((i) => i.menuId);
        const hasDuplicate = new Set(menuIds).size !== menuIds.length;

        if (hasDuplicate) {
          return helpers.message(
            'Duplicate menuId found in items. Combine the quantities of the same menu into a single item.'
          );
        }

        return items;
      })
      .messages({
        'array.min': 'The transaction must contain at least one item',
        'any.required': 'items is required',
      }),
  }),
};

const getSales = {
  query: Joi.object().keys({
    search: Joi.string().trim().allow(''),

    startDate: Joi.date().iso().messages({
      'date.format': 'startDate must be in YYYY-MM-DD format',
    }),

    endDate: Joi.date().iso().min(Joi.ref('startDate')).messages({
      'date.format': 'endDate must be in YYYY-MM-DD format',
      'date.min': 'endDate cannot be earlier than startDate',
    }),

    page: Joi.number().integer().min(1),

    limit: Joi.number().integer().min(1).max(100),

    sort: Joi.string(), // e.g. '-createdAt' or 'totalProfit'
  }),
};

module.exports = { createSales, getSales };
