const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { jwt: jwtConfig, otp: otpConfig } = require('../config/env');
const { generateOtp, hashOtp, getOtpExpiry } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');

const generateAccessToken = (user) =>
  // Misal user
  // {
  //   _id: "6871bc1f92c...",
  //   username: "daffa",
  //   email: "daffa@gmail.com",
  //   role: "admin"
  // }
  // isi Payload
  // {
  //   sub: "6871bc1f92c...",
  //   role: "admin"
  // }
  // Jadi token
  // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  // Validate User dengan token setelah di decode
  // {
  //   "sub": "6871bc1f92c...",
  //   "role": "admin",
  //   "iat": 1752220000,
  //   "exp": 1752223600
  // }
  jwt.sign({ sub: user._id, role: user.role }, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpires,
  });

const generateRefreshToken = (user) =>
  jwt.sign({ sub: user._id }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpires,
  });

const register = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'Email sudah terdaftar');
  }

  const user = await User.create({ name, email, password });

  // Kirim kode verifikasi otomatis, reuse logic yang sama dengan endpoint send.
  // Sengaja panggil function-nya langsung (bukan HTTP call ke diri sendiri).
  await sendVerificationCode(email);

  // TIDAK menerbitkan accessToken/refreshToken di sini secara sengaja,
  // karena user belum verifikasi email → belum boleh dianggap "login".
  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Email atau password salah');
  }

  if (!user.isEmailVerified) {
    // code khusus supaya frontend gampang bedakan dari error 401 biasa,
    // lalu redirect ke halaman verifikasi
    throw new ApiError(403, 'Email belum diverifikasi', { code: 'EMAIL_NOT_VERIFIED' });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

const refresh = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
  } catch (err) {
    throw new ApiError(401, 'Refresh token tidak valid atau kedaluwarsa');
  }

  const user = await User.findById(decoded.sub).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw new ApiError(401, 'Refresh token tidak dikenali');
  }

  const accessToken = generateAccessToken(user);
  return { accessToken };
};

const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

/* -------------------------------------------------------------------------- */
/* Email verification                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Kirim (atau kirim ulang) kode verifikasi email.
 * Dipakai baik oleh endpoint POST /verify-email/send maupun dipanggil
 * langsung dari register(). Sengaja HANYA satu function untuk send & resend.
 */
const sendVerificationCode = async (email) => {
  const user = await User.findOne({ email }).select('+emailVerificationSentAt +isEmailVerified');

  // Beda dengan forgot-password, di sini email SUDAH pasti ada (baru register
  // atau user memang sedang login flow verifikasi), jadi boleh kasih tahu
  // kalau tidak ditemukan.
  if (!user) {
    throw new ApiError(404, 'Email tidak ditemukan');
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, 'Email sudah terverifikasi');
  }

  // Cooldown resend, cegah spam ke SMTP & inbox user
  if (user.emailVerificationSentAt) {
    const secondsSinceLastSend = (Date.now() - user.emailVerificationSentAt.getTime()) / 1000;
    if (secondsSinceLastSend < otpConfig.resendCooldownSeconds) {
      const wait = Math.ceil(otpConfig.resendCooldownSeconds - secondsSinceLastSend);
      throw new ApiError(429, `Tunggu ${wait} detik sebelum meminta kode baru`);
    }
  }

  const code = generateOtp();
  user.emailVerificationCode = hashOtp(code);
  user.emailVerificationExpires = getOtpExpiry();
  user.emailVerificationSentAt = new Date();
  user.emailVerificationAttempts = 0;
  await user.save();

  await sendOtpEmail({ to: user.email, code, purpose: 'verify-email' });
};

/**
 * Konfirmasi kode verifikasi email.
 */
const confirmVerificationCode = async (email, code) => {
  const user = await User.findOne({ email }).select(
    '+emailVerificationCode +emailVerificationExpires +emailVerificationAttempts +isEmailVerified'
  );

  if (!user) {
    throw new ApiError(404, 'Email tidak ditemukan');
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, 'Email sudah terverifikasi');
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpires) {
    throw new ApiError(400, 'Belum ada kode verifikasi, silakan minta kode baru');
  }

  if (user.emailVerificationAttempts >= otpConfig.maxAttempts) {
    throw new ApiError(429, 'Terlalu banyak percobaan, silakan minta kode baru');
  }

  if (user.emailVerificationExpires.getTime() < Date.now()) {
    throw new ApiError(400, 'Kode sudah kedaluwarsa, silakan minta kode baru');
  }

  if (hashOtp(code) !== user.emailVerificationCode) {
    user.emailVerificationAttempts += 1;
    await user.save();
    throw new ApiError(400, 'Kode tidak valid');
  }

  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  user.emailVerificationSentAt = undefined;
  user.emailVerificationAttempts = 0;
  await user.save();
};

/* -------------------------------------------------------------------------- */
/* Forgot password (Pattern B: send -> verify-code -> reset-password)         */
/* -------------------------------------------------------------------------- */

/**
 * Langkah 1: kirim kode reset ke email. Response harus SELALU generic
 * (tidak boleh bocorkan apakah email terdaftar atau tidak), jadi function
 * ini sengaja tidak throw error untuk kasus "email tidak ditemukan" —
 * silent return, caller (controller) yang selalu kasih message generic.
 */
const forgotPassword = async (email) => {
  const user = await User.findOne({ email }).select('+resetPasswordSentAt');

  if (!user) return; // sengaja diam, jangan bocorkan info

  if (user.resetPasswordSentAt) {
    const secondsSinceLastSend = (Date.now() - user.resetPasswordSentAt.getTime()) / 1000;
    if (secondsSinceLastSend < otpConfig.resendCooldownSeconds) {
      // Untuk forgot-password, tetap silent-return supaya timing attack
      // (mengukur response time) tidak bisa dipakai menebak email terdaftar.
      return;
    }
  }

  const code = generateOtp();
  user.resetPasswordCode = hashOtp(code);
  user.resetPasswordExpires = getOtpExpiry();
  user.resetPasswordSentAt = new Date();
  user.resetPasswordAttempts = 0;
  await user.save();

  await sendOtpEmail({ to: user.email, code, purpose: 'forgot-password' });
};

/**
 * Langkah 2: verifikasi kode reset, kalau valid terbitkan resetToken (JWT
 * short-lived, single-use lewat nonce) untuk dipakai di langkah 3.
 */
const verifyResetCode = async (email, code) => {
  const user = await User.findOne({ email }).select(
    '+resetPasswordCode +resetPasswordExpires +resetPasswordAttempts'
  );

  // Di sini BOLEH kasih tahu kalau tidak ketemu/kode salah, karena user
  // sudah lolos tahap 1 (menerima email) — bukan lagi celah enumeration.
  if (!user || !user.resetPasswordCode || !user.resetPasswordExpires) {
    throw new ApiError(400, 'Kode tidak valid, silakan minta kode baru');
  }

  if (user.resetPasswordAttempts >= otpConfig.maxAttempts) {
    throw new ApiError(429, 'Terlalu banyak percobaan, silakan minta kode baru');
  }

  if (user.resetPasswordExpires.getTime() < Date.now()) {
    throw new ApiError(400, 'Kode sudah kedaluwarsa, silakan minta kode baru');
  }

  if (hashOtp(code) !== user.resetPasswordCode) {
    user.resetPasswordAttempts += 1;
    await user.save();
    throw new ApiError(400, 'Kode tidak valid');
  }

  // Kode benar → hapus kode (satu kali pakai), generate nonce untuk resetToken
  const nonce = crypto.randomBytes(16).toString('hex');
  user.resetPasswordCode = undefined;
  user.resetPasswordExpires = undefined;
  user.resetPasswordAttempts = 0;
  user.resetPasswordNonce = nonce;
  await user.save();

  const resetToken = jwt.sign(
    { sub: user._id, purpose: 'reset-password', nonce },
    jwtConfig.resetSecret,
    { expiresIn: jwtConfig.resetExpires }
  );

  return { resetToken };
};

/**
 * Langkah 3: pakai resetToken (sudah divalidasi oleh middleware
 * verifyResetToken, user tersedia di req.resetUser) untuk set password baru.
 */
const resetPassword = async (user, newPassword) => {
  user.password = newPassword; // di-hash otomatis lewat pre('save') hook
  user.resetPasswordNonce = undefined; // consume nonce, resetToken jadi tidak valid lagi
  user.refreshToken = null; // paksa logout semua device lama
  await user.save();
};

/* -------------------------------------------------------------------------- */
/* Change password (user sudah login)                                        */
/* -------------------------------------------------------------------------- */

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new ApiError(404, 'User tidak ditemukan');
  }

  const isOldPasswordCorrect = await user.comparePassword(oldPassword);
  if (!isOldPasswordCorrect) {
    throw new ApiError(401, 'Password lama tidak sesuai');
  }

  const isSameAsOld = await bcrypt.compare(newPassword, user.password);
  if (isSameAsOld) {
    throw new ApiError(400, 'Password baru tidak boleh sama dengan password lama');
  }

  user.password = newPassword;
  user.refreshToken = null; // paksa login ulang di device lain
  await user.save();
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  sendVerificationCode,
  confirmVerificationCode,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  changePassword,
};
