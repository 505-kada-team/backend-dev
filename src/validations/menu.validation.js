const Joi = require('joi');

const objectId = (value, helpers) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" tidak valid, harus berupa ObjectId MongoDB');
  }
  return value;
};

const ingredientItem = Joi.object({
  inventoryId: Joi.string().custom(objectId).required().messages({
    'any.required': 'inventoryId wajib diisi',
    'string.pattern.base': 'inventoryId tidak valid',
  }),
  kuantitasDibutuhkan: Joi.number().positive().required().messages({
    'number.positive': 'kuantitasDibutuhkan harus lebih besar dari 0',
    'any.required': 'kuantitasDibutuhkan wajib diisi',
  }),
});

const createMenu = {
  body: Joi.object().keys({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).allow('', null),
    sellingPrice: Joi.number().min(0).required(),
    ingredients: Joi.array().items(ingredientItem).min(1).required().messages({
      'array.min': 'Menu harus memiliki minimal 1 ingredient',
      'any.required': 'ingredients wajib diisi',
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
    .min(1) // minimal 1 field yang mau diupdate, tolak body kosong
    .messages({
      'object.min': 'Minimal 1 field harus diisi untuk update',
    }),
};

module.exports = {
  createMenu,
  updateMenu,
};
