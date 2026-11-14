import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Activate() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [state, setState] = useState({ status: 'loading', message: '' });
  const started = useRef(false); // токен одноразовий, тож у StrictMode запит має піти лише раз

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api('/auth/activate', { method: 'POST', body: { token: params.get('token') } })
      .then((r) => {
        setState({ status: 'ok', message: r.message });
        refresh();
      })
      .catch((e) => setState({ status: 'error', message: e.message }));
  }, [params, refresh]);

  return (
    <section className="panel narrow">
      <h1>Активація облікового запису</h1>
      {state.status === 'loading' && <p className="muted">Перевіряємо посилання…</p>}
      {state.status === 'ok' && <p className="success">{state.message}</p>}
      {state.status === 'error' && <p className="error">{state.message}</p>}
      <Link to="/login">Перейти до входу</Link>
    </section>
  );
}
