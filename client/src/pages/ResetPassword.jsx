import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { isValidPassword } from '../passwordPolicy';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Паролі не збігаються');
    try {
      const r = await api('/auth/reset-password', {
        method: 'POST',
        body: { token: params.get('token'), password },
      });
      setMessage(r.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel narrow">
      <h1>Новий пароль</h1>
      {message ? (
        <>
          <p className="success">{message}</p>
          <Link to="/login">Увійти</Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="password">Новий пароль</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Повторіть пароль</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
          <PasswordStrength password={password} />
          {error && <p className="error" role="alert">{error}</p>}
          <button disabled={!isValidPassword(password)}>Зберегти пароль</button>
        </form>
      )}
    </section>
  );
}
