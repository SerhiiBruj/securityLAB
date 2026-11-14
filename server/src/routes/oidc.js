const express = require('express');
const jwt = require('jsonwebtoken');
const { Issuer, generators } = require('openid-client');
const db = require('../db');
const cfg = require('../config');
const { logAttempt } = require('../utils/log');
const { completeLogin } = require('../utils/users');

const router = express.Router();
const COOKIE = 'oidc_tx';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', secure: cfg.isProd, path: '/api/auth/oidc' };

let clientPromise;
function getClient() {
  clientPromise ??= Issuer.discover(cfg.oidc.issuer).then(
    (issuer) =>
      new issuer.Client({
        client_id: cfg.oidc.clientId,
        client_secret: cfg.oidc.clientSecret,
        redirect_uris: [cfg.oidc.redirectUri],
        response_types: ['code'],
      })
  );
  clientPromise.catch(() => (clientPromise = null)); // дозволяємо повторну спробу discovery
  return clientPromise;
}

router.use('/oidc', (req, res, next) =>
  cfg.oidc.enabled ? next() : res.status(503).json({ error: 'OIDC-вхід не налаштовано' })
);

// Крок 1: перенаправляємо на провайдера. state, nonce і PKCE verifier зберігаємо у підписаному cookie.
router.get('/oidc/login', async (req, res) => {
  const client = await getClient();
  const state = generators.state();
  const nonce = generators.nonce();
  const verifier = generators.codeVerifier();

  res.cookie(COOKIE, jwt.sign({ state, nonce, verifier }, cfg.jwtSecret, { expiresIn: '10m' }), {
    ...COOKIE_OPTS,
    maxAge: 10 * 60_000,
  });
  res.redirect(
    client.authorizationUrl({
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: generators.codeChallenge(verifier),
      code_challenge_method: 'S256',
    })
  );
});

// Крок 2: провайдер повертає користувача з code. Бібліотека перевіряє state, nonce, підпис і термін id_token.
router.get('/oidc/callback', async (req, res) => {
  const fail = (reason) => {
    logAttempt(req, { email: '(oidc)', method: 'oidc', success: false, reason });
    res.redirect(`${cfg.clientUrl}/login?error=${reason}`);
  };

  try {
    const client = await getClient();
    const tx = jwt.verify(String(req.cookies[COOKIE] ?? ''), cfg.jwtSecret, { algorithms: ['HS256'] });
    res.clearCookie(COOKIE, COOKIE_OPTS);

    const tokenSet = await client.callback(cfg.oidc.redirectUri, client.callbackParams(req), {
      state: tx.state,
      nonce: tx.nonce,
      code_verifier: tx.verifier,
    });
    const claims = tokenSet.claims();
    const email = String(claims.email ?? '').toLowerCase();
    if (!email || claims.email_verified !== true) return fail('oidc_email');

    let user = db
      .prepare('SELECT * FROM users WHERE oidc_issuer = ? AND oidc_sub = ?')
      .get(claims.iss, claims.sub);

    if (!user) {
      const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (existing) {
        if (existing.oidc_sub) return fail('oidc_conflict'); // email уже прив'язаний до іншого зовнішнього акаунта
        // Прив'язуємо до наявного акаунта. Якщо email ще не був підтверджений, пароль (його міг задати
        // сторонній) скидаємо, щоб власник скористався відновленням.
        db.prepare(
          `UPDATE users SET oidc_issuer = ?, oidc_sub = ?, is_activated = 1,
             password_hash = CASE WHEN is_activated = 1 THEN password_hash ELSE NULL END
           WHERE id = ?`
        ).run(claims.iss, claims.sub, existing.id);
      } else {
        db.prepare(
          `INSERT INTO users (email, password_hash, is_activated, oidc_issuer, oidc_sub, created_at)
           VALUES (?, NULL, 1, ?, ?, ?)`
        ).run(email, claims.iss, claims.sub, Date.now());
      }
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }

    if (user.is_blocked) {
      logAttempt(req, { userId: user.id, email, method: 'oidc', success: false, reason: 'blocked' });
      return res.redirect(`${cfg.clientUrl}/login?error=blocked`);
    }

    // Провайдер уже автентифікував користувача, тому власний TOTP не запитуємо
    completeLogin(req, res, user, 'oidc');
    res.redirect(`${cfg.clientUrl}/profile`);
  } catch (err) {
    console.error('OIDC помилка:', err.message);
    fail('oidc');
  }
});

module.exports = router;
