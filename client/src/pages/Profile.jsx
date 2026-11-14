import { useState } from 'react';
import { api, fmtDate } from '../api';
import { useAuth } from '../auth.jsx';

function TwoFactor() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState(null); // { qr, secret } під час підключення
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const run = async (fn) => {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
  };

  const start = () => run(async () => setSetup(await api('/profile/2fa/setup', { method: 'POST' })));
  const enable = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api('/profile/2fa/enable', { method: 'POST', body: { code } });
      setUser(r.user);
      setSetup(null);
      setCode('');
    });
  };
  const disable = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api('/profile/2fa/disable', { method: 'POST', body: { code, password } });
      setUser(r.user);
      setCode('');
      setPassword('');
    });
  };

  return (
    <section className="block">
      <h2>Двофакторна автентифікація</h2>
      {user.totpEnabled ? (
        <form onSubmit={disable}>
          <p className="success">Увімкнено. Під час входу потрібен код із застосунку.</p>
          <p className="muted">Щоб вимкнути, підтвердьте дію.</p>
          {user.hasPassword && (
            <div className="field">
              <label htmlFor="pw">Пароль</label>
              <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="code">Поточний код</label>
            <input id="code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="danger">Вимкнути 2FA</button>
        </form>
      ) : setup ? (
        <form onSubmit={enable}>
          <p>Відскануйте QR-код у Google Authenticator, Authy або іншому TOTP-застосунку, потім введіть код.</p>
          <img className="qr" src={setup.qr} alt="QR-код для 2FA" width="180" height="180" />
          <p className="muted">Або введіть ключ вручну: <code>{setup.secret}</code></p>
          <div className="field">
            <label htmlFor="code">Код із застосунку</label>
            <input id="code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row">
            <button>Увімкнути 2FA</button>
            <button type="button" className="secondary" onClick={() => setSetup(null)}>Скасувати</button>
          </div>
        </form>
      ) : (
        <>
          <p>Вимкнено. Додайте другий фактор, щоб захистити вхід навіть у разі витоку пароля.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button onClick={start}>Налаштувати 2FA</button>
        </>
      )}
    </section>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [notice, setNotice] = useState('');

  async function resend() {
    setNotice('');
    try {
      setNotice((await api('/profile/resend-activation', { method: 'POST' })).message);
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <section className="panel">
      <h1>Профіль</h1>
      <dl className="facts">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Роль</dt>
        <dd>{user.role === 'admin' ? 'Адміністратор' : 'Користувач'}</dd>
        <dt>Активація</dt>
        <dd>
          <span className={`badge ${user.isActivated ? 'ok' : 'warn'}`}>
            {user.isActivated ? 'Активовано' : 'Не активовано'}
          </span>
        </dd>
        <dt>Вхід через Google</dt>
        <dd>{user.oidcLinked ? 'Підключено' : 'Не підключено'}</dd>
        <dt>Зареєстровано</dt>
        <dd>{fmtDate(user.createdAt)}</dd>
        <dt>Останній вхід</dt>
        <dd>{fmtDate(user.lastLoginAt)}</dd>
      </dl>

      {!user.isActivated && (
        <div className="notice">
          <p>Підтвердьте email: ми надіслали лист із посиланням для активації.</p>
          <button className="secondary" onClick={resend}>Надіслати лист ще раз</button>
          {notice && <p className="muted">{notice}</p>}
        </div>
      )}

      <TwoFactor />
    </section>
  );
}
