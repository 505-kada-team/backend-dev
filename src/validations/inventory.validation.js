const Joi = require("joi");

const validUnits = ["gram", "kg", "ml", "liter", "pcs", "piece"];

const getAllInventory = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10),

    search: Joi.string().allow(""),

    sort: Joi.string(),
  }),
};

const createInventory = {
  body: Joi.object({
    ingredientName: Joi.string().trim().min(2).max(100).required(),

    unit: Joi.string()
      .valid(...validUnits)
      .required(),

    quantity: Joi.number()
      .min(0)
      .required(),

    unitCost: Joi.number()
      .min(0)
      .required(),

    validFrom: Joi.date().required(),

    validTo: Joi.date()
      .greater(Joi.ref("validFrom"))
      .required()
      .messages({
        "date.greater": "validTo must be later than validFrom",
      }),
  }),
};

const updateInventory = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),

  body: Joi.object({
    ingredientName: Joi.string().trim().min(2).max(100),

    unit: Joi.string().valid(...validUnits),

    quantity: Joi.number().min(0),

    unitCost: Joi.number().min(0),

    validFrom: Joi.date(),

    validTo: Joi.date().when("validFrom", {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref("validFrom")),
      otherwise: Joi.date(),
    }),
  }).min(1),
};

const inventoryId = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

module.exports = {
  getAllInventory,
  createInventory,
  updateInventory,
  inventoryId,
};