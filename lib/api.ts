const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:5000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// Singleton refresh promise to prevent concurrent refresh races
let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const newToken = data?.data?.authToken;
      if (newToken) {
        localStorage.setItem('auth_token', newToken);
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  document.cookie = 'auth-session=; path=/; max-age=0';
  window.location.href = '/auth';
}

async function apiFetch(path: string, init: RequestInit = {}, _isRetry = false): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401 && !_isRetry && path !== '/auth/refresh' && path !== '/auth/login') {
    const newToken = await tryRefresh();
    if (newToken) return apiFetch(path, init, true);
    clearAuth();
    throw new Error('Session expired. Please log in again.');
  }

  if (res.status === 401) {
    clearAuth();
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
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

    signup: (firstName: string, lastName: string, email: string, password: string) =>
      apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ firstName, lastName, email, password }) }),

    acceptInvite: (code: string, firstName: string, lastName: string, password: string) =>
      apiFetch('/auth/accept-invite', { method: 'POST', body: JSON.stringify({ code, firstName, lastName, password }) }),

    forgotPassword: (email: string) =>
      apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

    resetPassword: (code: string, password: string) =>
      apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ code, password }) }),

    logout: () => {
      // Fire-and-forget — revokes the httpOnly refresh cookie on the server
      fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    },
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
      apiFetch(`/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify({ body, type, attachments }) }),
    updateStatus: (id: string, status: string) =>
      apiFetch(`/conversations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    snooze: (id: string, snoozedUntil: number) =>
      apiFetch(`/conversations/${id}/snooze`, { method: 'POST', body: JSON.stringify({ snoozedUntil }) }),
    create: (contactId: string, body: string, subject?: string, messageType: 'inapp' | 'email' = 'inapp') =>
      apiFetch('/conversations', { method: 'POST', body: JSON.stringify({ contactId, body, subject, messageType }) }),
    createByEmail: (email: string, body: string, subject?: string, messageType: 'inapp' | 'email' = 'inapp') =>
      apiFetch('/conversations', { method: 'POST', body: JSON.stringify({ email, body, subject, messageType }) }),
    search: (q: string) => apiFetch(`/conversations/search?q=${encodeURIComponent(q)}`),
    assign: (id: string, agentId: string | null) =>
      apiFetch(`/conversations/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ agentId }) }),
    oneClickLogin: (id: string) =>
      apiFetch(`/conversations/${id}/one-click-login`, { method: 'POST' }),
  },

  contacts: {
    search: (q: string) => apiFetch(`/contacts/search?q=${encodeURIComponent(q)}`),
  },

  tags: {
    list: () => apiFetch('/tags'),
    create: (name: string) => apiFetch('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: (id: string) => apiFetch(`/tags/${id}`, { method: 'DELETE' }),
    add: (conversationId: string, tagId: string) =>
      apiFetch(`/conversations/${conversationId}/tags`, { method: 'POST', body: JSON.stringify({ tagId }) }),
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
    createTask: (payload: { name: string; description: string; priority: string; assigneeId: number | null }) =>
      apiFetch('/clickup/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  },

  agents: {
    list: () => apiFetch('/agents'),
    permissionsMatrix: () => apiFetch('/agents/permissions-matrix'),
    invite: (email: string, role: string) =>
      apiFetch('/agents/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
    updateRole: (id: string, role: string) =>
      apiFetch(`/agents/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    updateStatus: (id: string, status: string) =>
      apiFetch(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    updatePermission: (id: string, key: string, granted: boolean) =>
      apiFetch(`/agents/${id}/permissions`, { method: 'PATCH', body: JSON.stringify({ key, granted }) }),
  },

  analytics: {
    performance: (params?: { agentId?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.agentId) q.set('agentId', params.agentId);
      if (params?.from)    q.set('from',    params.from);
      if (params?.to)      q.set('to',      params.to);
      const qs = q.toString();
      return apiFetch(`/analytics/performance${qs ? `?${qs}` : ''}`);
    },
  },

  auditLogs: {
    list: (params?: { agentId?: string; action?: string; targetId?: string; from?: string; to?: string; page?: number; perPage?: number }) => {
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

  settings: {
    get: () => apiFetch('/settings'),
    update: (payload: Record<string, any>) =>
      apiFetch('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  },

  alerts: {
    list: () => apiFetch('/alerts'),
  },

  ai: {
    compose: (conversationId: string, draft: string, mode: 'rephrase' | 'formal' | 'friendly' | 'concise' | 'expand' | 'translate', targetLanguage?: string) =>
      apiFetch('/ai/compose', { method: 'POST', body: JSON.stringify({ conversationId, draft, mode, targetLanguage }) }),
    summarize: (conversationId: string) =>
      apiFetch('/ai/summarize', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    suggest: (conversationId: string) =>
      apiFetch('/ai/suggest', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    suggestMacros: (conversationId: string) =>
      apiFetch('/ai/suggest-macros', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    suggestArticles: (conversationId: string) =>
      apiFetch('/ai/suggest-articles', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    autoTag: (conversationId: string) =>
      apiFetch('/ai/auto-tag', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    applyTags: (conversationId: string, tagIds: string[]) =>
      apiFetch('/ai/apply-tags', { method: 'POST', body: JSON.stringify({ conversationId, tagIds }) }),
    chat: (conversationId: string, message: string, history?: { role: string; content: string }[]) =>
      apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ conversationId, message, history }) }),
    insights: (days = 7) =>
      apiFetch(`/ai/insights?days=${days}`),
    diagnose: (conversationId: string, query: string) =>
      apiFetch('/ai/diagnose', { method: 'POST', body: JSON.stringify({ conversationId, query }) }),
    diagnoseHints: (conversationId: string) =>
      apiFetch('/ai/diagnose-hints', { method: 'POST', body: JSON.stringify({ conversationId }) }),
    sentiment: (conversationId: string) =>
      apiFetch('/ai/sentiment', { method: 'POST', body: JSON.stringify({ conversationId }) }),
  },

  sseUrl: () => {
    const token = getToken();
    return `${API_BASE}/api/v1/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
