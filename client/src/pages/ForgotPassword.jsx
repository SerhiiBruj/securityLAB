import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      setMessage((await api('/auth/forgot-password', { method: 'POST', body: { email } })).message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel narrow">
      <h1>Відновлення пароля</h1>
      {message ? (
        <p className="success">{message}</p>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email облікового запису</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button>Надіслати посилання</button>
        </form>
      )}
      <p className="muted"><Link to="/login">Повернутися до входу</Link></p>
    </section>
  );
}
