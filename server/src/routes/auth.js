const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { authenticator } = require('otplib');
const db = require('../db');
const cfg = require('../config');
const { clearAuthCookie } = require('../middleware/auth');
const { hashPassword, verifyPassword, validatePassword } = require('../utils/password');
const { createToken, consumeToken } = require('../utils/tokens');
const { createCaptcha, verifyCaptcha } = require('../utils/captcha');
const { logAttempt } = require('../utils/log');
const {
  publicUser, lockMinutesLeft, registerFailure, completeLogin, sendActivationEmail,
} = require('../utils/users');
const { sendMail } = require('../mailer');

authenticator.options = { window: 1 }; // допускаємо зсув годинника ±30 с

const router = express.Router();

const limiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Забагато запитів, спробуйте пізніше' },
  });
const strictLimiter = limiter(30); // ліміт по IP на чутливі маршрути
const captchaLimiter = limiter(90);

const GENERIC_LOGIN_ERROR = 'Невірний email або пароль';
const normEmail = (v) => String(v ?? '').trim().toLowerCase();
const isEmail = (v) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const getByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);
const lockedMessage = (min) => `Забагато невдалих спроб. Спробуйте через ${min} хв`;

function checkTotp(code, secret) {
  try {
    return authenticator.check(String(code ?? '').replace(/\s/g, ''), secret);
  } catch {
    return false;
  }
}

// true, якщо відповідь уже відправлено (акаунт заблоковано адміном або тимчасово)
function rejectIfUnavailable(req, res, user, method) {
  if (user.is_blocked) {
    logAttempt(req, { userId: user.id, email: user.email, method, success: false, reason: 'blocked' });
    res.status(403).json({ error: 'Обліковий запис заблоковано адміністратором' });
    return true;
  }
  const left = lockMinutesLeft(user);
  if (left) {
    logAttempt(req, { userId: user.id, email: user.email, method, success: false, reason: 'locked' });
    res.status(429).json({ error: lockedMessage(left) });
    return true;
  }
  return false;
}

router.get('/config', (req, res) => res.json({ oidcEnabled: cfg.oidc.enabled }));

// Завдання 2: CAPTCHA
router.get('/captcha', captchaLimiter, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(createCaptcha());
});

// Завдання 1, 2, 3: реєстрація з політикою пароля, CAPTCHA і листом активації
router.post('/register', strictLimiter, async (req, res) => {
  const { password, captchaId, captchaAnswer } = req.body;
  const email = normEmail(req.body.email);

  if (!verifyCaptcha(captchaId, captchaAnswer)) {
    return res.status(400).json({ error: 'Невірна CAPTCHA. Спробуйте ще раз' });
  }
  if (!isEmail(email)) return res.status(400).json({ error: 'Некоректний email' });
  const errors = validatePassword(password);
  if (errors.length) {
    return res.status(400).json({ error: 'Пароль не відповідає політиці', details: errors });
  }
  if (getByEmail(email)) return res.status(409).json({ error: 'Цей email уже зареєстровано' });

  const hash = await hashPassword(password);
  const info = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, hash, Date.now());
  sendActivationEmail({ id: Number(info.lastInsertRowid), email }).catch((e) =>
    console.error('Не вдалося надіслати лист:', e.message)
  );
  res.status(201).json({ message: 'Реєстрацію завершено. Ми надіслали лист із посиланням для активації' });
});

// Завдання 3: активація за одноразовим токеном (POST, щоб поштові сканери не "спалювали" посилання)
router.post('/activate', strictLimiter, (req, res) => {
  const row = consumeToken(req.body.token, 'activation');
  if (!row) return res.status(400).json({ error: 'Посилання недійсне або термін його дії минув' });
  db.prepare('UPDATE users SET is_activated = 1 WHERE id = ?').run(row.user_id);
  res.json({ message: 'Обліковий запис активовано' });
});

// Завдання 1 і 4: вхід з лічильником невдалих спроб і тимчасовим блокуванням
router.post('/login', strictLimiter, async (req, res) => {
  const email = normEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = getByEmail(email);

  if (!user) {
    await verifyPassword(null, password); // вирівнюємо час відповіді
    logAttempt(req, { email, success: false, reason: 'unknown_user' });
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }
  if (rejectIfUnavailable(req, res, user, 'password')) return;

  if (!(await verifyPassword(user.password_hash, password))) {
    const nowLocked = registerFailure(user);
    logAttempt(req, {
      userId: user.id, email, success: false, reason: nowLocked ? 'bad_password_locked' : 'bad_password',
    });
    return nowLocked
      ? res.status(429).json({ error: lockedMessage(cfg.lockMinutes) })
      : res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }

  // Завдання 5: пароль вірний, але потрібен другий фактор
  if (user.totp_enabled) {
    const tempToken = jwt.sign({ sub: user.id, typ: '2fa' }, cfg.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: '5m',
    });
    return res.json({ twoFactorRequired: true, tempToken });
  }

  completeLogin(req, res, user, 'password');
  res.json({ user: publicUser(user) });
});

// Завдання 5: другий крок входу (TOTP-код)
router.post('/login/2fa', strictLimiter, (req, res) => {
  const expired = () => res.status(401).json({ error: 'Час входу минув. Увійдіть ще раз' });
  let payload;
  try {
    payload = jwt.verify(String(req.body.tempToken ?? ''), cfg.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return expired();
  }
  if (payload.typ !== '2fa') return expired();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user || !user.totp_enabled) return expired();
  if (rejectIfUnavailable(req, res, user, '2fa')) return;

  if (!checkTotp(req.body.code, user.totp_secret)) {
    const nowLocked = registerFailure(user); // невірні коди теж рахуються до ліміту
    logAttempt(req, {
      userId: user.id, email: user.email, method: '2fa', success: false, reason: 'bad_code',
    });
    return nowLocked
      ? res.status(429).json({ error: lockedMessage(cfg.lockMinutes) })
      : res.status(401).json({ error: 'Невірний код' });
  }

  completeLogin(req, res, user, 'password+2fa');
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Завдання 7: запит на відновлення пароля (відповідь однакова, чи існує email)
router.post('/forgot-password', strictLimiter, (req, res) => {
  const user = getByEmail(normEmail(req.body.email));
  if (user && !user.is_blocked) {
    const token = createToken(user.id, 'reset', cfg.resetTtlMin);
    const link = `${cfg.clientUrl}/reset-password?token=${token}`;
    sendMail({
      to: user.email,
      subject: 'Відновлення пароля',
      text: `Щоб задати новий пароль, відкрийте посилання (діє ${cfg.resetTtlMin} хв):\n${link}\n\nЯкщо ви не просили зміну пароля, проігноруйте цей лист.`,
      html: `<p>Щоб задати новий пароль, відкрийте посилання (діє ${cfg.resetTtlMin} хв):</p><p><a href="${link}">${link}</a></p><p>Якщо ви не просили зміну пароля, проігноруйте цей лист.</p>`,
    }).catch((e) => console.error('Не вдалося надіслати лист:', e.message));
  }
  res.json({ message: 'Якщо такий email зареєстровано, ми надіслали інструкції для відновлення пароля' });
});

// Завдання 7: встановлення нового пароля за токеном
router.post('/reset-password', strictLimiter, async (req, res) => {
  const errors = validatePassword(req.body.password); // спершу пароль, щоб слабкий пароль не "спалив" токен
  if (errors.length) {
    return res.status(400).json({ error: 'Пароль не відповідає політиці', details: errors });
  }
  const row = consumeToken(req.body.token, 'reset');
  if (!row) return res.status(400).json({ error: 'Посилання недійсне або термін його дії минув' });

  const hash = await hashPassword(req.body.password);
  // Перехід за посиланням із пошти підтверджує email, тому акаунт також активується
  db.prepare(
    'UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, is_activated = 1 WHERE id = ?'
  ).run(hash, row.user_id);
  res.json({ message: 'Пароль змінено. Тепер можна увійти' });
});

module.exports = router;
