const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      document.cookie = 'auth-session=; path=/; max-age=0';
      window.location.href = '/auth';
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    signup: (
      firstName: string,
      lastName: string,
      email: string,
      password: string
    ) =>
      apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, password }),
      }),
  },

  conversations: {
    list: (params?: { page?: number; perPage?: number; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.perPage) q.set('perPage', String(params.perPage));
      if (params?.status) q.set('status', params.status);
      const qs = q.toString();
      return apiFetch(`/conversations${qs ? `?${qs}` : ''}`);
    },

    get: (id: string) => apiFetch(`/conversations/${id}`),

    reply: (id: string, body: string, type: 'comment' | 'note' = 'comment') =>
      apiFetch(`/conversations/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body, type }),
      }),

    updateStatus: (id: string, status: string) =>
      apiFetch(`/conversations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  sseUrl: () => {
    const token = getToken();
    return `${API_BASE}/api/v1/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
