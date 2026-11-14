// Ті самі правила, що й на сервері (utils/password.js). Сервер лишається головним, тут лише підказки.
export const rules = [
  { id: 'len', label: 'Щонайменше 8 символів', test: (p) => p.length >= 8 },
  { id: 'case', label: 'Великі та малі літери', test: (p) => /\p{Lu}/u.test(p) && /\p{Ll}/u.test(p) },
  { id: 'digit', label: 'Цифра', test: (p) => /\d/.test(p) },
  { id: 'sym', label: 'Символ (не літера і не цифра)', test: (p) => /[^\p{L}\p{N}]/u.test(p) },
];

export const isValidPassword = (p) => rules.every((r) => r.test(p));

// 0..5: виконані правила плюс бонус за довжину від 12 символів
export function strength(p) {
  if (!p) return { score: 0, label: '' };
  const score = rules.filter((r) => r.test(p)).length + (p.length >= 12 ? 1 : 0);
  const label = score <= 2 ? 'Слабкий' : score === 3 ? 'Середній' : score === 4 ? 'Добрий' : 'Надійний';
  return { score, label };
}
