// Talks to the Render backend. Render's free tier sleeps when idle, so the first request can take
// 30-60 seconds. Requests retry on network errors and 502-504 instead of failing at once.

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(path, { method = 'GET', body, retries = 2, timeoutMs = 25000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (res.status >= 502 && res.status <= 504 && attempt < retries) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
      return data;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ApiError) throw e;
      lastErr = e;
      if (attempt < retries) await sleep(3000 * (attempt + 1));
    }
  }
  throw new ApiError('Cannot reach the server. It may be waking up; try again in a moment.', 0);
}

export const api = {
  base: BASE,
  // a single long wait, used on page load to wake the free-tier server
  wake: () => request('/health', { retries: 0, timeoutMs: 90000 }),
  createCall: (body) => request('/api/calls', { method: 'POST', body }),
  saveStage: (id, n, body) => request(`/api/calls/${id}/stages/${n}`, { method: 'PUT', body, retries: 1 }),
  check: (id, body) => request(`/api/calls/${id}/check`, { method: 'POST', body, retries: 0, timeoutMs: 30000 }),
  closeCall: (id, body) => request(`/api/calls/${id}/close`, { method: 'POST', body }),
  listCalls: () => request('/api/calls'),
  getCall: (id) => request(`/api/calls/${id}`),
};
