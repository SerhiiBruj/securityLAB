import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

// onChange({ id, answer }). Щоб скинути CAPTCHA після помилки, змініть key компонента.
export default function Captcha({ onChange }) {
  const [captcha, setCaptcha] = useState(null);
  const [answer, setAnswer] = useState('');

  const load = useCallback(async () => {
    setAnswer('');
    const data = await api('/auth/captcha');
    setCaptcha(data);
    onChange({ id: data.id, answer: '' });
  }, [onChange]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handle = (value) => {
    setAnswer(value);
    onChange({ id: captcha?.id ?? '', answer: value });
  };

  return (
    <div className="field">
      <label htmlFor="captcha">Введіть символи із зображення</label>
      <div className="captcha-row">
        {captcha ? (
          <img
            alt="CAPTCHA"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`}
            width="160"
            height="56"
          />
        ) : (
          <div className="captcha-placeholder" />
        )}
        <button type="button" className="secondary" onClick={() => load().catch(() => {})}>
          Інше зображення
        </button>
      </div>
      <input
        id="captcha"
        value={answer}
        onChange={(e) => handle(e.target.value)}
        autoComplete="off"
        required
      />
    </div>
  );
}
