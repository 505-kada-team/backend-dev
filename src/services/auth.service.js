const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { jwt: jwtConfig } = require('../config/env');

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

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Email atau password salah');
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

module.exports = { register, login, refresh, logout };
