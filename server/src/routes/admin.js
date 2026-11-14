const express = require('express');
const db = require('../db');

// Доступ лише для ролі admin перевіряється в index.js (requireRole('admin'))
const router = express.Router();

// Список користувачів та їх статус
router.get('/users', (req, res) => {
  const users = db
    .prepare(
      `SELECT id, email, role, is_activated, is_blocked, totp_enabled, failed_attempts,
              locked_until, created_at, last_login_at
       FROM users ORDER BY id`
    )
    .all();
  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActivated: !!u.is_activated,
      isBlocked: !!u.is_blocked,
      totpEnabled: !!u.totp_enabled,
      failedAttempts: u.failed_attempts,
      lockedUntil: u.locked_until && u.locked_until > Date.now() ? u.locked_until : null,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
    })),
  });
});

function setBlocked(blocked) {
  return (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некоректний id' });
    if (blocked && id === req.user.id) {
      return res.status(400).json({ error: 'Не можна заблокувати власний обліковий запис' });
    }
    // Розблокування одразу скидає і тимчасове блокування від brute force
    const info = db
      .prepare(
        blocked
          ? 'UPDATE users SET is_blocked = 1 WHERE id = ?'
          : 'UPDATE users SET is_blocked = 0, failed_attempts = 0, locked_until = NULL WHERE id = ?'
      )
      .run(id);
    if (!info.changes) return res.status(404).json({ error: 'Користувача не знайдено' });
    res.json({ ok: true });
  };
}
router.post('/users/:id/block', setBlocked(true));
router.post('/users/:id/unblock', setBlocked(false));

// Журнал усіх спроб входу (з фільтром за email)
router.get('/logs', (req, res) => {
  const q = String(req.query.email ?? '').trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const rows = db
    .prepare('SELECT * FROM login_log WHERE email LIKE ? ORDER BY id DESC LIMIT ?')
    .all(`%${q}%`, limit);
  res.json({
    logs: rows.map((r) => ({
      id: r.id,
      email: r.email,
      ip: r.ip,
      userAgent: r.user_agent,
      method: r.method,
      success: !!r.success,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  });
});

// Підсумок: хто і скільки разів намагався увійти
router.get('/logs/summary', (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.email,
              COUNT(*) AS total,
              SUM(l.success) AS successes,
              COUNT(*) - SUM(l.success) AS failures,
              MAX(l.created_at) AS last_attempt,
              (SELECT ip FROM login_log x WHERE x.email = l.email ORDER BY x.id DESC LIMIT 1) AS last_ip
       FROM login_log l
       GROUP BY l.email
       ORDER BY failures DESC, last_attempt DESC
       LIMIT 200`
    )
    .all();
  res.json({
    summary: rows.map((r) => ({
      email: r.email,
      total: r.total,
      successes: r.successes,
      failures: r.failures,
      lastAttempt: r.last_attempt,
      lastIp: r.last_ip,
    })),
  });
});

module.exports = router;
