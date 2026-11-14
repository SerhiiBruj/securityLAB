const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cfg = require('./config');
const db = require('./db');
const { requireAuth, requireRole } = require('./middleware/auth');
const { hashPassword, validatePassword } = require('./utils/password');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', 1); // за reverse proxy, щоб у журналі був справжній IP

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/oidc'));

app.use('/api/profile', requireAuth, require('./routes/profile'));
app.use('/api/admin', requireAuth, requireRole('admin'), require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Не знайдено' }));

if (cfg.isProd) {
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некоректний JSON' });
  console.error(err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// Перший адміністратор з .env
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return;
  const errors = validatePassword(password);
  if (errors.length) return console.warn('ADMIN_PASSWORD не відповідає політиці:', errors.join(', '));
  db.prepare(
    "INSERT INTO users (email, password_hash, role, is_activated, created_at) VALUES (?, ?, 'admin', 1, ?)"
  ).run(email, await hashPassword(password), Date.now());
  console.log(`Створено адміністратора ${email}`);
}

seedAdmin().then(() =>
  app.listen(cfg.port, () => console.log(`API: http://localhost:${cfg.port}`))
);
