const db = require('../db');

const insert = db.prepare(`
  INSERT INTO login_log (user_id, email, ip, user_agent, method, success, reason, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Журнал входів для адміністратора: хто, звідки, яким способом і чим закінчилась спроба
function logAttempt(req, { userId = null, email, method = 'password', success, reason = null }) {
  insert.run(
    userId,
    String(email ?? '').toLowerCase().slice(0, 255),
    req.ip,
    String(req.get('user-agent') ?? '').slice(0, 255),
    method,
    success ? 1 : 0,
    reason,
    Date.now()
  );
}

module.exports = { logAttempt };
