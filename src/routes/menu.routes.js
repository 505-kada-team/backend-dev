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
router.get('/', authenticate, validate(menuValidation.getAllMenu), getMenu);
router.get('/:id', authenticate, validate(menuValidation.menuId), getMenuById);
router.post('/', authenticate, validate(menuValidation.createMenu), createMenu);
router.put('/:id', authenticate, validate(menuValidation.updateMenu), updateMenu);
router.delete('/:id', authenticate, deleteMenu);
router.delete('/:id', authenticate, validate(menuValidation.menuId), deleteMenu);

module.exports = router;
