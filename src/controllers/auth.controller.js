const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/auth.service');

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie('refreshToken', refreshToken, cookieOptions);
  return new ApiResponse(201, { user, accessToken }, 'Registrasi berhasil').send(res);
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  const platform = req.headers['x-platform'];
  const isMobile = platform === 'mobile';

  if (!isMobile) {
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return new ApiResponse(200, { user, accessToken }, 'Login berhasil').send(res);
  }

  return new ApiResponse(200, { user, accessToken, refreshToken }, 'Login berhasil').send(res);
});

const refresh = asyncHandler(async (req, res) => {
  // Prioritas cookie (Web + Postman), fallback ke body (Mobile)
  const token = req.cookies?.refreshToken || req.body.refreshToken;

  if (!token) {
    throw new ApiError(401, 'Refresh token not found');
  }

  const { accessToken } = await authService.refresh(token);

  return new ApiResponse(200, { accessToken }, 'Token refreshed successfully').send(res);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  res.clearCookie('refreshToken', cookieOptions);
  return new ApiResponse(200, null, 'Logout berhasil').send(res);
});

const me = asyncHandler(async (req, res) => {
  return new ApiResponse(200, req.user, 'Data user berhasil diambil').send(res);
});

/* --- Email verification --- */

const sendVerificationEmail = asyncHandler(async (req, res) => {
  await authService.sendVerificationCode(req.body.email);
  return new ApiResponse(200, null, 'Kode verifikasi telah dikirim ke email kamu').send(res);
});

const confirmVerificationEmail = asyncHandler(async (req, res) => {
  await authService.confirmVerificationCode(req.body.email, req.body.code);
  return new ApiResponse(200, null, 'Email berhasil diverifikasi').send(res);
});

/* --- Forgot password --- */

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  // Response SELALU generic, terlepas dari email ada atau tidak di DB
  return new ApiResponse(200, null, 'Jika email terdaftar, kode reset password telah dikirim').send(
    res
  );
});

const verifyResetCode = asyncHandler(async (req, res) => {
  const result = await authService.verifyResetCode(req.body.email, req.body.code);
  return new ApiResponse(200, result, 'Kode terverifikasi').send(res);
});

const resetPassword = asyncHandler(async (req, res) => {
  // req.resetUser diisi oleh middleware verifyResetToken
  await authService.resetPassword(req.resetUser, req.body.newPassword);
  return new ApiResponse(200, null, 'Password berhasil direset, silakan login ulang').send(res);
});

/* --- Change password (protected) --- */

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body.oldPassword, req.body.newPassword);
  return new ApiResponse(
    200,
    null,
    'Password berhasil diubah, silakan login ulang di device lain'
  ).send(res);
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  sendVerificationEmail,
  confirmVerificationEmail,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  changePassword,
};
