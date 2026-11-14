import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

const OIDC_ERRORS = {
  oidc: 'Не вдалося увійти через зовнішнього провайдера',
  oidc_email: 'Провайдер не підтвердив ваш email',
  oidc_conflict: 'Цей email уже прив\'язано до іншого зовнішнього акаунта',
  blocked: 'Обліковий запис заблоковано адміністратором',
};

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refresh, config } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tempToken, setTempToken] = useState(null); // з'являється, коли потрібен код 2FA
  const [code, setCode] = useState('');
  const [error, setError] = useState(OIDC_ERRORS[params.get('error')] ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tempToken) {
        await api('/auth/login/2fa', { method: 'POST', body: { tempToken, code } });
      } else {
        const r = await api('/auth/login', { method: 'POST', body: { email, password } });
        if (r.twoFactorRequired) {
          setTempToken(r.tempToken);
          return;
        }
      }
      await refresh();
      navigate('/profile');
    } catch (err) {
      setError(err.message);
      if (err.status === 429 || err.message.startsWith('Час входу')) {
        setTempToken(null);
        setCode('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow">
      <h1>{tempToken ? 'Код підтвердження' : 'Вхід'}</h1>
      <form onSubmit={submit}>
        {tempToken ? (
          <div className="field">
            <label htmlFor="code">Код із застосунку-автентифікатора</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <button disabled={busy}>{tempToken ? 'Підтвердити' : 'Увійти'}</button>
   
      </form>

      {!tempToken && (
        <>
          {config.oidcEnabled && (
            <a className="button secondary wide" href="/api/auth/oidc/login">Увійти через Google</a>
          )}
          <p className="muted">
            <Link to="/forgot-password">Забули пароль?</Link> · <Link to="/register">Створити обліковий запис</Link>
          </p>
        </>
      )}
    </section>
  );
}
