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
    const msg = data?.message || data?.error;
    if (!msg && res.status === 403) throw new Error('Access denied');
    throw new Error(msg || `Request failed (${res.status})`);
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

    reply: (id: string, body: string, type: 'comment' | 'note' = 'comment', attachments?: { filename: string; mimeType: string; base64: string }[]) =>
      apiFetch(`/conversations/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body, type, attachments }),
      }),

    updateStatus: (id: string, status: string) =>
      apiFetch(`/conversations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    snooze: (id: string, snoozedUntil: number) =>
      apiFetch(`/conversations/${id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ snoozedUntil }),
      }),

    create: (contactId: string, body: string, subject?: string, messageType: 'inapp' | 'email' = 'inapp') =>
      apiFetch('/conversations', {
        method: 'POST',
        body: JSON.stringify({ contactId, body, subject, messageType }),
      }),

    search: (q: string) => apiFetch(`/conversations/search?q=${encodeURIComponent(q)}`),
  },

  contacts: {
    search: (q: string) => apiFetch(`/contacts/search?q=${encodeURIComponent(q)}`),
  },

  tags: {
    list: () => apiFetch('/tags'),
    create: (name: string) =>
      apiFetch('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: (id: string) => apiFetch(`/tags/${id}`, { method: 'DELETE' }),
    add: (conversationId: string, tagId: string) =>
      apiFetch(`/conversations/${conversationId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tagId }),
      }),
    remove: (conversationId: string, tagId: string) =>
      apiFetch(`/conversations/${conversationId}/tags/${tagId}`, { method: 'DELETE' }),
  },

  articles: {
    list: (params?: { page?: number; perPage?: number }) => {
      const q = new URLSearchParams();
      if (params?.page) q.set('page', String(params.page));
      if (params?.perPage) q.set('perPage', String(params.perPage));
      const qs = q.toString();
      return apiFetch(`/articles${qs ? `?${qs}` : ''}`);
    },
    create: (payload: { title: string; body: string; state?: 'published' | 'draft' }) =>
      apiFetch('/articles', { method: 'POST', body: JSON.stringify(payload) }),
    delete: (id: string) => apiFetch(`/articles/${id}`, { method: 'DELETE' }),
  },

  macros: {
    list: () => apiFetch('/macros'),
    create: (payload: { name: string; description: string; actions: any[] }) =>
      apiFetch('/macros', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<{ name: string; description: string; actions: any[] }>) =>
      apiFetch(`/macros/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    delete: (id: string) => apiFetch(`/macros/${id}`, { method: 'DELETE' }),
    apply: (macroId: string, conversationId: string) =>
      apiFetch(`/macros/${macroId}/apply/${conversationId}`, { method: 'POST' }),
  },

  clickup: {
    getMembers: () => apiFetch('/clickup/members'),

    createTask: (payload: {
      name: string;
      description: string;
      priority: string;
      assigneeId: number | null;
    }) =>
      apiFetch('/clickup/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  agents: {
    list: () => apiFetch('/agents'),
    permissionsMatrix: () => apiFetch('/agents/permissions-matrix'),
    updateRole: (id: string, role: string) =>
      apiFetch(`/agents/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    updateStatus: (id: string, status: string) =>
      apiFetch(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    updatePermission: (id: string, key: string, granted: boolean) =>
      apiFetch(`/agents/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ key, granted }) }),
  },

  auditLogs: {
    list: (params?: {
      agentId?: string;
      action?: string;
      targetId?: string;
      from?: string;
      to?: string;
      page?: number;
      perPage?: number;
    }) => {
      const q = new URLSearchParams();
      if (params?.agentId)  q.set('agentId',  params.agentId);
      if (params?.action)   q.set('action',   params.action);
      if (params?.targetId) q.set('targetId', params.targetId);
      if (params?.from)     q.set('from',     params.from);
      if (params?.to)       q.set('to',       params.to);
      if (params?.page)     q.set('page',     String(params.page));
      if (params?.perPage)  q.set('perPage',  String(params.perPage));
      const qs = q.toString();
      return apiFetch(`/audit-logs${qs ? `?${qs}` : ''}`);
    },
  },

  sseUrl: () => {
    const token = getToken();
    return `${API_BASE}/api/v1/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
