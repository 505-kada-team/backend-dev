const express = require('express');
const controller = require('../controllers/planning.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // semua route planning wajib login

router
  .route('/')
  .get(controller.getAll)
  .post(controller.create);

router
  .route('/:id')
  .get(controller.getById)
  .put(controller.update)
  .delete(controller.remove);

router.patch('/:id/set-final', controller.setFinal);

module.exports = router;