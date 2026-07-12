const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { jwt: jwtConfig } = require('../config/env');
const User = require('../models/user.model');

/**
 * Verifikasi resetToken yang dikirim di body request (bukan header Bearer).
 * Token ini SENGAJA dipisah dari authenticate karena:
 * - signed dengan secret berbeda (JWT_RESET_SECRET)
 * - hanya valid untuk purpose 'reset-password'
 * - single-use, divalidasi lewat nonce yang tersimpan di DB
 *
 * Setelah lolos, req.resetUser diisi supaya controller/service tidak perlu
 * query ulang.
 */
const verifyResetToken = asyncHandler(async (req, res, next) => {
  const { resetToken } = req.body;

  if (!resetToken) {
    throw new ApiError(400, 'Reset token tidak ditemukan');
  }

  let decoded;
  try {
    decoded = jwt.verify(resetToken, jwtConfig.resetSecret);
  } catch (err) {
    throw new ApiError(401, 'Reset token tidak valid atau sudah kedaluwarsa');
  }

  if (decoded.purpose !== 'reset-password') {
    throw new ApiError(401, 'Token tidak valid untuk aksi ini');
  }

  const user = await User.findById(decoded.sub).select('+resetPasswordNonce +password');
  if (!user || !user.resetPasswordNonce || user.resetPasswordNonce !== decoded.nonce) {
    throw new ApiError(401, 'Reset token sudah dipakai atau tidak valid');
  }

  req.resetUser = user;
  next();
});

module.exports = verifyResetToken;
