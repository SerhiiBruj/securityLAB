const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT,                                  -- NULL для акаунтів, створених через OIDC
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_activated    INTEGER NOT NULL DEFAULT 0,
  is_blocked      INTEGER NOT NULL DEFAULT 0,            -- блокування адміністратором
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    INTEGER,                               -- тимчасове блокування (мс, epoch)
  totp_secret         TEXT,
  totp_pending_secret TEXT,
  totp_enabled        INTEGER NOT NULL DEFAULT 0,
  oidc_issuer     TEXT,
  oidc_sub        TEXT,
  created_at      INTEGER NOT NULL,
  last_login_at   INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc
  ON users (oidc_issuer, oidc_sub) WHERE oidc_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,                       -- у БД лише SHA-256 від токена
  type       TEXT NOT NULL CHECK (type IN ('activation', 'reset')),
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE IF NOT EXISTS login_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  email      TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  method     TEXT NOT NULL,
  success    INTEGER NOT NULL,
  reason     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_email ON login_log (email);
`);
const columns = db.prepare(
  "PRAGMA table_info(users)"
).all();

if (!columns.some(col => col.name === 'totp_pending_secret')) {
  db.exec(
    'ALTER TABLE users ADD COLUMN totp_pending_secret TEXT'
  );
}

module.exports = db;
