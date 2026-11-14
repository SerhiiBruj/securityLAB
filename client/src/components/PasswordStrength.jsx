import { rules, strength } from '../passwordPolicy';

export default function PasswordStrength({ password }) {
  const { score, label } = strength(password);
  return (
    <div className="strength" aria-live="polite">
      <div className="meter" data-score={score}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= score ? 'on' : ''} />
        ))}
      </div>
      <p className="strength-label">{label || 'Введіть пароль'}</p>
      <ul className="rules">
        {rules.map((r) => (
          <li key={r.id} className={r.test(password) ? 'ok' : ''}>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
