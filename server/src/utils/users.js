const db = require('../db');
const cfg = require('../config');
const { setAuthCookie } = require('../middleware/auth');
const { logAttempt } = require('./log');
const { createToken } = require('./tokens');
const { sendMail } = require('../mailer');

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    isActivated: !!u.is_activated,
    totpEnabled: !!u.totp_enabled,
    hasPassword: !!u.password_hash,
    oidcLinked: !!u.oidc_sub,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  };
}

function lockMinutesLeft(user) {
  return user.locked_until && user.locked_until > Date.now()
    ? Math.ceil((user.locked_until - Date.now()) / 60000)
    : 0;
}

function registerFailure(user) {
  db.prepare(
    'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?'
  ).run(user.id);

  const { failed_attempts } = db
    .prepare('SELECT failed_attempts FROM users WHERE id = ?')
    .get(user.id);

  if (failed_attempts >= cfg.maxFailedAttempts) {
    db.prepare(
      'UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?'
    ).run(
      Date.now() + cfg.lockMinutes * 60000,
      user.id
    );

    return true;
  }

  return false;
}

function completeLogin(req, res, user, method = 'password') {
  db.prepare(`
    UPDATE users
    SET failed_attempts = 0,
        locked_until = NULL,
        last_login_at = ?
    WHERE id = ?
  `).run(Date.now(), user.id);

  logAttempt(req, {
    userId: user.id,
    email: user.email,
    method,
    success: true,
  });

  setAuthCookie(res, user.id);
}

async function sendActivationEmail(user) {
  const token = createToken(
    user.id,
    'activation',
    cfg.activationTtlMin
  );

  const link = `${cfg.clientUrl}/activate?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Активація облікового запису',
    text: `Щоб активувати обліковий запис, відкрийте посилання (діє 24 години):\n${link}`,
    html: `
      <h2>Активація облікового запису</h2>
      <p>Щоб активувати обліковий запис, натисніть посилання:</p>
      <p><a href="${link}">Активувати акаунт</a></p>
      <p>Посилання діє 24 години.</p>
    `,
  });
}

async function sendPasswordResetEmail(user) {
  const token = createToken(
    user.id,
    'reset',
    cfg.resetTtlMin
  );

  const link = `${cfg.clientUrl}/reset-password?token=${token}`;

  await sendMail({
    to: user.email,
    subject: 'Відновлення пароля',
    text: `Для відновлення пароля відкрийте посилання (діє 30 хвилин):\n${link}`,
    html: `
      <h2>Відновлення пароля</h2>
      <p>Щоб встановити новий пароль, натисніть:</p>
      <p><a href="${link}">Відновити пароль</a></p>
      <p>Посилання діє 30 хвилин.</p>
    `,
  });
}

module.exports = {
  publicUser,
  lockMinutesLeft,
  registerFailure,
  completeLogin,
  sendActivationEmail,
  sendPasswordResetEmail,
};
