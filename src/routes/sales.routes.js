const express = require('express');
const { getSales, getSalesById, createSales } = require('../controllers/sales.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const salesValidation = require('../validations/sales.validation');

const router = express.Router();

router.get('/', authenticate, validate(salesValidation.getSales), getSales);
router.get('/:id', authenticate, getSalesById);
router.post('/', authenticate, validate(salesValidation.createSales), createSales);

module.exports = router;
