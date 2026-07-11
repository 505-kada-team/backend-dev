const express = require('express');
const { register, login, refresh, logout, me } = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const authValidation = require('../validations/auth.validation');

const router = express.Router();

router.post('/register', validate(authValidation.register), register);
router.post('/login', validate(authValidation.login), login);
router.post('/refresh', validate(authValidation.refresh), refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
