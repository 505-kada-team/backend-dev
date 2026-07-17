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
    throw new ApiError(401, 'No token provided, access denied');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, jwtConfig.accessSecret);
  } catch (err) {
    // Tangkap TokenExpiredError & JsonWebTokenError di sini, jangan biarkan
    // lolos ke error handler generic -- supaya response-nya konsisten 401,
    // bukan 500.
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findById(decoded.sub).select('+passwordChangedAt +tokenVersion');
  if (!user) {
    throw new ApiError(401, 'Token owner not found');
  }

  if (decoded.tokenVersion !== user.tokenVersion) {
    throw new ApiError(401, 'Token is no longer valid, please log in again');
  }

  if (user.passwordChangedAt) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (decoded.iat < changedAtSeconds) {
      throw new ApiError(401, 'Password recently changed, please log in again');
    }
  }

  req.user = user;
  next();
});

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to access this resource');
    }
    next();
  };

module.exports = { authenticate, authorize };
