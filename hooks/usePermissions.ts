"use client";

import { useAuth } from "@/contexts/AuthContext";
import type { AgentRole } from "@/contexts/AuthContext";

export function usePermissions() {
  const { user, isLoading } = useAuth();

  const can = (key: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(key);
  };

  const role: AgentRole = user?.role ?? "agent";
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isAgent = role === "agent";

  return { can, role, isAdmin, isSupervisor, isAgent, isLoading };
}
