const crypto = require('crypto');
const db = require('../db');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// Створює одноразовий токен. Користувачу йде "сирий" токен (в листі), у БД лежить лише його хеш
function createToken(userId, type, ttlMinutes) {
  const raw = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM tokens WHERE user_id = ? AND type = ?').run(userId, type); // старі токени втрачають силу
  db.prepare(
    'INSERT INTO tokens (user_id, token_hash, type, expires_at) VALUES (?, ?, ?, ?)'
  ).run(userId, sha256(raw), type, Date.now() + ttlMinutes * 60_000);
  return raw;
}

// Повертає запис токена, якщо він дійсний, і одразу позначає його використаним
function consumeToken(raw, type) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  const row = db
    .prepare('SELECT * FROM tokens WHERE token_hash = ? AND type = ?')
    .get(sha256(raw), type);
  if (!row || row.used_at || row.expires_at < Date.now()) return null;
  const res = db
    .prepare('UPDATE tokens SET used_at = ? WHERE id = ? AND used_at IS NULL')
    .run(Date.now(), row.id);
  return res.changes === 1 ? row : null;
}

module.exports = { createToken, consumeToken };
