require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'dev-only-secret-change-me';

if (isProd && jwtSecret.length < 32) {
  throw new Error('У production потрібно задати JWT_SECRET довжиною щонайменше 32 символи');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret,
  sessionHours: 2,
  maxFailedAttempts: 5, // невдалих спроб до блокування
  lockMinutes: 15, // тривалість тимчасового блокування
  activationTtlMin: 24 * 60,
  resetTtlMin: 30,
  mailFrom: process.env.MAIL_FROM || 'Auth Lab <no-reply@example.com>',
  oidc: {
    issuer: process.env.OIDC_ISSUER || 'https://accounts.google.com',
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    redirectUri:
      process.env.OIDC_REDIRECT_URI ||
      'http://localhost:4000/api/auth/oidc/callback',
    enabled: Boolean(process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
  },
};
