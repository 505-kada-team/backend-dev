const Joi = require('joi');

const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" is invalid. It must be a valid MongoDB ObjectId');
  }
  return value;
};

const ingredientItem = Joi.object({
  inventoryId: Joi.string().custom(objectId).required().messages({
    'any.required': 'inventoryId is required',
    'string.pattern.base': 'inventoryId is invalid',
  }),
  quantityNeeded: Joi.number().positive().required().messages({
    'number.positive': 'quantityNeeded must be greater than 0',
    'any.required': 'quantityNeeded is required',
  }),
});

const createMenu = {
  body: Joi.object().keys({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).allow('', null),
    sellingPrice: Joi.number().min(0).required(),
    ingredients: Joi.array().items(ingredientItem).min(1).required().messages({
      'array.min': 'Menu must contain at least 1 ingredient',
      'any.required': 'ingredients is required',
    }),
  }),
};

const updateMenu = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().trim().min(1).max(100),
      description: Joi.string().trim().max(500).allow('', null),
      sellingPrice: Joi.number().min(0),
      ingredients: Joi.array().items(ingredientItem).min(1),
    })
    .min(1)
    .messages({
      'object.min': 'At least 1 field is required for update',
    }),
};

module.exports = {
  createMenu,
  updateMenu,
};
