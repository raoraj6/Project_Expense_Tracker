const BASE = import.meta.env.VITE_API_URL ?? '/api';

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function token() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    onUnauthorized();
    throw new Error('Your session expired. Please sign in again.');
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.details)
      ? ` (${data.details.map((d) => `${d.path}: ${d.message}`).join(', ')})`
      : '';
    throw new Error((data.error ?? `Request failed with ${res.status}`) + detail);
  }
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),

  categories: () => request('/categories'),
  listTransactions: (params) => request('/transactions', { params }),
  createTransaction: (body) => request('/transactions', { method: 'POST', body }),
  updateTransaction: (id, body) => request(`/transactions/${id}`, { method: 'PATCH', body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  stats: (params) => request('/stats', { params }),

  aiStatus: () => request('/ai/status'),
  aiCategorize: (body) => request('/ai/categorize', { method: 'POST', body }),
  aiInsights: (params) => request('/ai/insights', { params }),
};
