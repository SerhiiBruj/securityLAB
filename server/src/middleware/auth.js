const jwt = require('jsonwebtoken');
const db = require('../db');
const cfg = require('../config');

// Сесія: JWT в HttpOnly cookie (недоступний для JavaScript, тобто захищений від крадіжки через XSS)
function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId, typ: 'session' }, cfg.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${cfg.sessionHours}h`,
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax', // cookie не надсилається з міжсайтовими POST-запитами (захист від CSRF)
    secure: cfg.isProd,
    maxAge: cfg.sessionHours * 3600_000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: cfg.isProd });
}

function requireAuth(req, res, next) {
  let payload;
  try {
    payload = jwt.verify(String(req.cookies.token ?? ''), cfg.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Потрібно увійти в систему' });
  }
  if (payload.typ !== 'session') return res.status(401).json({ error: 'Потрібно увійти в систему' });

  // Користувача читаємо з БД на кожен запит, тож блокування адміністратором діє одразу
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user) return res.status(401).json({ error: 'Потрібно увійти в систему' });
  if (user.is_blocked) {
    clearAuthCookie(res);
    return res.status(403).json({ error: 'Обліковий запис заблоковано адміністратором' });
  }
  req.user = user;
  next();
}

// RBAC: пропускає лише вказані ролі
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Недостатньо прав' });

module.exports = { setAuthCookie, clearAuthCookie, requireAuth, requireRole };
