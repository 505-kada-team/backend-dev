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
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX: Joi.number().default(100),
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
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX,
  },
};
