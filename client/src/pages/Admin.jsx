import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '../api';
import { useAuth } from '../auth.jsx';

const REASONS = {
  bad_password: 'Невірний пароль',
  bad_password_locked: 'Невірний пароль, акаунт заблоковано',
  bad_code: 'Невірний код 2FA',
  unknown_user: 'Невідомий email',
  locked: 'Тимчасове блокування',
  blocked: 'Заблоковано адміністратором',
  oidc: 'Помилка OIDC',
  oidc_email: 'Email не підтверджено провайдером',
  oidc_conflict: 'Конфлікт акаунтів OIDC',
};

function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api('/admin/users').then((r) => setUsers(r.users)).catch((e) => setError(e.message)),
    []
  );
  useEffect(() => { load(); }, [load]);

  async function toggle(u) {
    setError('');
    try {
      await api(`/admin/users/${u.id}/${u.isBlocked ? 'unblock' : 'block'}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Email</th><th>Роль</th><th>Статус</th><th>2FA</th><th>Останній вхід</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role === 'admin' ? 'Адмін' : 'Користувач'}</td>
                <td>
                  {u.isBlocked ? <span className="badge bad">Заблоковано</span>
                    : u.lockedUntil ? <span className="badge warn">Тимчасово до {new Date(u.lockedUntil).toLocaleTimeString('uk-UA')}</span>
                    : u.isActivated ? <span className="badge ok">Активний</span>
                    : <span className="badge warn">Не активовано</span>}
                </td>
                <td>{u.totpEnabled ? 'Так' : 'Ні'}</td>
                <td>{fmtDate(u.lastLoginAt)}</td>
                <td>
                  {u.id !== me.id && (
                    <button className={u.isBlocked ? 'secondary small' : 'danger small'} onClick={() => toggle(u)}>
                      {u.isBlocked ? 'Розблокувати' : 'Заблокувати'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Logs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/admin/logs?email=${encodeURIComponent(filter)}`)
        .then((r) => setLogs(r.logs))
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [filter]);

  return (
    <>
      <div className="field inline">
        <label htmlFor="f">Фільтр за email</label>
        <input id="f" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Час</th><th>Email</th><th>IP</th><th>Спосіб</th><th>Результат</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{fmtDate(l.createdAt)}</td>
                <td>{l.email}</td>
                <td>{l.ip}</td>
                <td>{l.method}</td>
                <td>
                  <span className={`badge ${l.success ? 'ok' : 'bad'}`}>{l.success ? 'Успішно' : 'Невдало'}</span>{' '}
                  {l.reason && <span className="muted">{REASONS[l.reason] ?? l.reason}</span>}
                </td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan="5" className="muted">Записів немає</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Summary() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/admin/logs/summary').then((r) => setRows(r.summary)).catch(() => {}); }, []);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Email</th><th>Усього спроб</th><th>Невдалих</th><th>Успішних</th><th>Остання спроба</th><th>Останній IP</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.email}>
              <td>{r.email}</td>
              <td>{r.total}</td>
              <td className={r.failures >= 5 ? 'bad-text' : ''}>{r.failures}</td>
              <td>{r.successes}</td>
              <td>{fmtDate(r.lastAttempt)}</td>
              <td>{r.lastIp}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="6" className="muted">Записів немає</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { id: 'users', label: 'Користувачі', View: Users },
  { id: 'logs', label: 'Журнал входів', View: Logs },
  { id: 'summary', label: 'Спроби за email', View: Summary },
];

export default function Admin() {
  const [tab, setTab] = useState('users');
  const { View } = TABS.find((t) => t.id === tab);
  return (
    <section className="panel wide-panel">
      <h1>Адмін-панель</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <View />
    </section>
  );
}
