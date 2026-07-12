const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { jwt: jwtConfig } = require('../config/env');
const User = require('../models/user.model');

/**
 * Verifikasi access token dari header Authorization: Bearer <token>
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Tidak ada token, akses ditolak');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, jwtConfig.accessSecret);

  const user = await User.findById(decoded.sub).select('+passwordChangedAt');
  if (!user) {
    throw new ApiError(401, 'User pemilik token tidak ditemukan');
  }

  // Kalau password diganti setelah token ini diterbitkan, tolak token lama
  // meskipun secara masa berlaku (exp) dia belum expired.
  if (user.passwordChangedAt) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (decoded.iat < changedAtSeconds) {
      throw new ApiError(401, 'Password baru saja diubah, silakan login ulang');
    }
  }

  req.user = user;
  next();
});

/**
 * Batasi akses berdasarkan role, dipakai setelah authenticate.
 * Contoh: router.delete('/:id', authenticate, authorize('admin'), controller)
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'Anda tidak punya izin untuk mengakses resource ini');
    }
    next();
  };

module.exports = { authenticate, authorize };
