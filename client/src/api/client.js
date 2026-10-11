const TIMEOUT_MS = 30000;

const API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : '';

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = {
      ...options.headers
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const res = await fetch(targetUrl, {
      ...options,
      headers,
      body,
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await res.text();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      let errorMsg;
      if (res.status === 429) {
        errorMsg = 'Too many requests, wait a moment';
      } else {
        const raw =
          (data && typeof data === 'object' && (data.error || data.message)) ||
          res.statusText ||
          `HTTP ${res.status}`;
        errorMsg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      }
      return {
        ok: false,
        status: res.status,
        data,
        error: errorMsg
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
      error: null
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 408 : 0,
      data: null,
      error: isTimeout ? 'Request timed out after 30 seconds' : err.message || 'Network request failed'
    };
  }
}

export async function analyze({ instruction, memo = '' } = {}) {
  return request('/api/analyze', {
    method: 'POST',
    body: { instruction, memo }
  });
}

export async function execute(intent_token) {
  const body = typeof intent_token === 'object' ? intent_token : { intent_token };
  return request('/api/execute', {
    method: 'POST',
    body
  });
}

export async function getAccount() {
  return request('/api/bank/account', {
    method: 'GET'
  });
}

export async function getHealth() {
  return request('/health', {
    method: 'GET'
  });
}

export async function getAudit() {
  return request('/api/audit', {
    method: 'GET'
  });
}

export async function labMutate(body) {
  return request('/api/lab/mutate', {
    method: 'POST',
    body: body || {}
  });
}

export async function labCases() {
  return request('/api/lab/cases', {
    method: 'GET'
  });
}

export async function labBenchmark(mode = 'deterministic') {
  const body = typeof mode === 'string' ? { mode } : mode || { mode: 'deterministic' };
  return request('/api/lab/benchmark', {
    method: 'POST',
    body
  });
}

export async function authGuest() {
  return request('/api/auth/guest', {
    method: 'POST'
  });
}

export async function authMe() {
  return request('/api/auth/me', {
    method: 'GET'
  });
}

export async function authGoogle(credential) {
  const body = typeof credential === 'object' ? credential : { credential };
  return request('/api/auth/google', {
    method: 'POST',
    body
  });
}

export async function authLogout() {
  return request('/api/auth/logout', {
    method: 'POST'
  });
}
