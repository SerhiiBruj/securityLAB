const argon2 = require('argon2');

// Argon2id: параметри за рекомендацією OWASP (19 MiB пам'яті, 2 ітерації).
// Сіль генерується автоматично і зберігається всередині рядка хеша.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

const COMMON_PASSWORDS = new Set([
  'password1!', 'password123!', 'p@ssw0rd', 'p@ssword1', 'passw0rd!', 'qwerty123!',
  'qwerty12345!', 'admin123!', 'welcome1!', 'letmein1!', 'iloveyou1!', 'abcd1234!',
  'zaq12wsx!', 'changeme1!', 'qwerty1!', 'password1', 'qwerty123', 'admin#12345',
]);

// Повертає масив повідомлень про порушення політики (порожній масив = пароль ок)
function validatePassword(pw) {
  if (typeof pw !== 'string') return ["Пароль обов'язковий"];
  const errors = [];
  if (pw.length < 8) errors.push('Щонайменше 8 символів');
  if (pw.length > 128) errors.push('Не більше 128 символів');
  if (!/\p{Lu}/u.test(pw) || !/\p{Ll}/u.test(pw)) errors.push('Великі та малі літери');
  if (!/\d/.test(pw)) errors.push('Хоча б одна цифра');
  if (!/[^\p{L}\p{N}]/u.test(pw)) errors.push('Хоча б один символ (не літера і не цифра)');
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) errors.push('Занадто поширений пароль');
  return errors;
}

const hashPassword = (pw) => argon2.hash(pw, OPTIONS);

let dummyHash;
// Для неіснуючих акаунтів теж рахуємо хеш, щоб час відповіді не видавав, чи є такий email
async function fakeVerify(pw) {
  dummyHash ??= await hashPassword('Dummy-password-1!');
  await argon2.verify(dummyHash, pw).catch(() => false);
}

// argon2.verify перераховує хеш із тією ж сіллю і порівнює результати
async function verifyPassword(hash, pw) {
  if (!hash) {
    await fakeVerify(pw);
    return false;
  }
  try {
    return await argon2.verify(hash, pw);
  } catch {
    return false;
  }
}

module.exports = { validatePassword, hashPassword, verifyPassword, fakeVerify };
