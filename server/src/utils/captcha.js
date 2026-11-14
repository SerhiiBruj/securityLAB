const crypto = require('crypto');
const svgCaptcha = require('svg-captcha');

// Відповіді зберігаються на сервері (в пам'яті процесу). Для кількох інстансів потрібен Redis.
const store = new Map();
const TTL_MS = 5 * 60_000;
const MAX_ITEMS = 5000;

function createCaptcha() {
  const now = Date.now();
  for (const [id, item] of store) if (item.exp < now) store.delete(id);
  while (store.size >= MAX_ITEMS) store.delete(store.keys().next().value);

  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    width: 160,
    height: 56,
    fontSize: 46,
    background: '#eef2f5',
    ignoreChars: '0oO1lIi',
  });
  const id = crypto.randomUUID();
  store.set(id, { text: captcha.text.toLowerCase(), exp: now + TTL_MS });
  return { id, svg: captcha.data };
}

// Одноразова перевірка: після першої спроби CAPTCHA видаляється
function verifyCaptcha(id, answer) {
  const item = store.get(id);
  store.delete(id);
  return Boolean(
    item &&
      item.exp > Date.now() &&
      typeof answer === 'string' &&
      answer.trim().toLowerCase() === item.text
  );
}

module.exports = { createCaptcha, verifyCaptcha };
