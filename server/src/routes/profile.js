const express = require('express');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const { authenticator } = require('otplib');
const db = require('../db');
const { verifyPassword } = require('../utils/password');
const { publicUser, sendActivationEmail } = require('../utils/users');

authenticator.options = { window: 1 };

const router = express.Router();
const limiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Забагато запитів, спробуйте пізніше' },
  });

const checkTotp = (code, secret) => {
  try {
    return authenticator.check(String(code ?? '').replace(/\s/g, ''), secret);
  } catch {
    return false;
  }
};
const refreshed = (id) => publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));

// Користувач бачить лише власний профіль: id береться із сесії, а не з параметрів запиту
router.get('/', (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/resend-activation', limiter(5), async (req, res) => {
  if (req.user.is_activated) return res.status(400).json({ error: 'Обліковий запис уже активовано' });
  await sendActivationEmail(req.user);
  res.json({ message: 'Новий лист для активації надіслано' });
});

// Завдання 5: підключення TOTP. Крок 1: сервер генерує секрет і QR-код.
router.post('/2fa/setup', limiter(15), async (req, res) => {
  if (req.user.totp_enabled) return res.status(400).json({ error: '2FA уже ввімкнено' });
  const secret = authenticator.generateSecret();
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, req.user.id);
  const otpauth = authenticator.keyuri(req.user.email, 'Auth Lab', secret);
  res.json({ qr: await QRCode.toDataURL(otpauth), secret });
});

// Крок 2: підтвердження першим кодом із застосунку, і лише потім 2FA вмикається
router.post('/2fa/enable', limiter(15), (req, res) => {
  const { id, totp_secret, totp_enabled } = req.user;
  if (!totp_secret || totp_enabled) return res.status(400).json({ error: 'Спершу розпочніть налаштування 2FA' });
  if (!checkTotp(req.body.code, totp_secret)) return res.status(400).json({ error: 'Невірний код' });
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(id);
  res.json({ user: refreshed(id) });
});

// Вимкнення потребує підтвердження: код 2FA і пароль (якщо він заданий)
router.post('/2fa/disable', limiter(15), async (req, res) => {
  const u = req.user;
  if (!u.totp_enabled) return res.status(400).json({ error: '2FA не ввімкнено' });
  if (u.password_hash && !(await verifyPassword(u.password_hash, String(req.body.password ?? '')))) {
    return res.status(400).json({ error: 'Невірний пароль' });
  }
  if (!checkTotp(req.body.code, u.totp_secret)) return res.status(400).json({ error: 'Невірний код' });
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(u.id);
  res.json({ user: refreshed(u.id) });
});

module.exports = router;
