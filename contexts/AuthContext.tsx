"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";

export type AgentRole = 'admin' | 'supervisor' | 'agent';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  verified: boolean;
  role: AgentRole;
  status: 'active' | 'invited' | 'deactivated';
  permissions: string[];
  intercomAdminId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const u = payload?.user;
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName ?? null,
      verified: u.verified,
      role: u.role ?? 'agent',
      status: u.status ?? 'active',
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      intercomAdminId: u.intercomAdminId ?? null,
    };
  } catch {
    return null;
  }
}

function readStoredAuth(): { user: AuthUser | null; token: string | null } {
  if (typeof window === "undefined") return { user: null, token: null };
  const stored = localStorage.getItem("auth_token");
  if (!stored) return { user: null, token: null };
  const u = decodeJwtUser(stored);
  if (!u) { localStorage.removeItem("auth_token"); return { user: null, token: null }; }
  return { user: u, token: stored };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readStoredAuth();
  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [isLoading] = useState(false);

  useSSE({
    onPermissionsUpdated: useCallback((authToken: string) => {
      const u = decodeJwtUser(authToken);
      if (!u) return;
      if (u.status === 'deactivated') {
        localStorage.removeItem("auth_token");
        document.cookie = "auth-session=; path=/; max-age=0";
        setToken(null);
        setUser(null);
        window.location.href = '/auth?reason=deactivated';
        return;
      }
      localStorage.setItem("auth_token", authToken);
      setToken(authToken);
      setUser(u);
    }, []),
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    const authToken: string = res?.data?.authToken;
    if (!authToken) throw new Error("No token received from server");

    const u = decodeJwtUser(authToken);
    if (!u) throw new Error("Invalid token received");

    localStorage.setItem("auth_token", authToken);
    document.cookie = "auth-session=true; path=/; SameSite=Strict";
    setToken(authToken);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    document.cookie = "auth-session=; path=/; max-age=0";
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
