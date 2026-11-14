// Єдина точка звернення до API. credentials: 'include' потрібен для cookie із сесією.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Помилка запиту');
    err.status = res.status;
    err.details = data.details || [];
    throw err;
  }
  return data;
}

export const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString('uk-UA') : '—');
