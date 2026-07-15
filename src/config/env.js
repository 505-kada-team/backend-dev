const Joi = require('joi');
require('dotenv').config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  CLIENT_URL: Joi.string().uri().required(),
  MONGO_URI: Joi.string().required().description('Mongo DB connection string'),
  JWT_ACCESS_SECRET: Joi.string().min(20).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(20).required(),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
  JWT_RESET_SECRET: Joi.string().min(20).required(),
  JWT_RESET_EXPIRES: Joi.string().default('10m'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  // SMTP_HOST: Joi.string().required(),
  // SMTP_PORT: Joi.number().default(587),
  BREVO_API_KEY: Joi.string().required(),
  SMTP_USER: Joi.string().required(),
  SMTP_FROM_NAME: Joi.string().default('Capstone App'),
  OTP_LENGTH: Joi.number().default(6),
  OTP_EXPIRES_MINUTES: Joi.number().default(10),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().default(60),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),
}).unknown(true);

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  // Sengaja crash di awal, lebih baik gagal cepat daripada error random di tengah request
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  clientUrl: envVars.CLIENT_URL,
  mongoUri: envVars.MONGO_URI,
  jwt: {
    accessSecret: envVars.JWT_ACCESS_SECRET,
    accessExpires: envVars.JWT_ACCESS_EXPIRES,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpires: envVars.JWT_REFRESH_EXPIRES,
    resetSecret: envVars.JWT_RESET_SECRET,
    resetExpires: envVars.JWT_RESET_EXPIRES,
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX,
  },
  // smtp: {
  //   host: envVars.SMTP_HOST,
  //   port: envVars.SMTP_PORT,
  //   user: envVars.SMTP_USER,
  //   pass: envVars.SMTP_PASS,
  //   fromName: envVars.SMTP_FROM_NAME,
  // },
  brevo: {
    apiKey: envVars.BREVO_API_KEY,
    fromEmail: envVars.SMTP_USER,
    fromName: envVars.SMTP_FROM_NAME,
  },
  otp: {
    length: envVars.OTP_LENGTH,
    expiresMinutes: envVars.OTP_EXPIRES_MINUTES,
    resendCooldownSeconds: envVars.OTP_RESEND_COOLDOWN_SECONDS,
    maxAttempts: envVars.OTP_MAX_ATTEMPTS,
  },
};
