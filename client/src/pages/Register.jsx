import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Captcha from '../components/Captcha.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { isValidPassword } from '../passwordPolicy';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [captcha, setCaptcha] = useState({ id: '', answer: '' });
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Паролі не збігаються');
    setBusy(true);
    try {
      const r = await api('/auth/register', {
        method: 'POST',
        body: { email, password, captchaId: captcha.id, captchaAnswer: captcha.answer },
      });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="panel narrow">
        <h1>Перевірте пошту</h1>
        <p>{done}.</p>
        <p className="muted">Посилання діє 24 години. У режимі розробки без SMTP лист дивіться в консолі сервера.</p>
        <Link to="/login">Перейти до входу</Link>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Створити обліковий запис</h1>
      <form onSubmit={submit} className="split">
        <div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Повторіть пароль</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
        </div>
        <div>
          <PasswordStrength password={password} />
          <Captcha key={captchaKey} onChange={setCaptcha} />
        </div>
        <div className="full">
          {error && <p className="error" role="alert">{error}</p>}
          <button disabled={busy || !isValidPassword(password)}>Зареєструватися</button>
          <p className="muted">
            Уже є обліковий запис? <Link to="/login">Увійти</Link>
          </p>
        </div>
      </form>
    </section>
  );
}
