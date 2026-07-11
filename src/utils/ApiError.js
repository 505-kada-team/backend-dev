/**
 * Custom error class supaya semua error operasional (yang kita sengaja lempar)
 * punya bentuk konsisten: statusCode + message + optional details.
 *
 * Contoh pemakaian di service/controller:
 *   throw new ApiError(404, 'User tidak ditemukan');
 *   throw new ApiError(400, 'Validasi gagal', validationErrors);
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
