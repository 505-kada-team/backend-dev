const joi = require("joi");

const objectId = joi.string().hex().length(24);

const menuSchema = joi.object({
    menuId: objectId.required(),
    quantity: joi.number().integer().min(1).required(),
});

const createPlanning = {
    body: joi.object({
        name: joi.string().trim().min(2).max(100).required(),
        startDate: joi.date().required(),
        endDate: joi.date().min(joi.ref("startDate")).required(),
        menus: joi.array().items(menuSchema).min(1).required(),
    }),
};

const updatePlanning = {
    params: joi.object({id: objectId.required(),}),
    body: joi.object({
        name: joi.string().trim().min(2).max(100),
        startDate: joi.date(),
        endDate: joi.date(),
        menus: joi.array().items(menuSchema).min(1),
    }).min(1),
};

const planningId = {params: joi.object({id: objectId.required(),})};

module.exports = {
    createPlanning,
    updatePlanning,
    planningId,
};