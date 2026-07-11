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

  if (platform === 'web') {
    res.cookie('refreshToken', refreshToken, cookieOptions);
    return new ApiResponse(200, { user, accessToken }, 'Login berhasil').send(res);
  }

  return new ApiResponse(200, { user, accessToken, refreshToken }, 'Login berhasil').send(res);
});

const refresh = asyncHandler(async (req, res) => {
  // Refresh token bisa datang dari cookie (web) atau body (mobile/testing)
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  const { accessToken } = await authService.refresh(token);
  return new ApiResponse(200, { accessToken }, 'Token berhasil diperbarui').send(res);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  res.clearCookie('refreshToken', cookieOptions);
  return new ApiResponse(200, null, 'Logout berhasil').send(res);
});

const me = asyncHandler(async (req, res) => {
  return new ApiResponse(200, req.user, 'Data user berhasil diambil').send(res);
});

module.exports = { register, login, refresh, logout, me };
