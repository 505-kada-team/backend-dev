const express = require('express');
const {
  getMenu,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
} = require('../controllers/menu.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const menuValidation = require('../validations/menu.validation');

const router = express.Router();

router.get('/', authenticate, getMenu);
router.get('/:id', authenticate, getMenuById);
router.post('/', authenticate, validate(menuValidation.createMenu), createMenu);
router.put('/:id', authenticate, validate(menuValidation.updateMenu), updateMenu);
router.delete('/:id', authenticate, deleteMenu);

module.exports = router;
