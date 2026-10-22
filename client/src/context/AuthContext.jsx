import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  return { ...user, orgId: user.orgId ?? user.org_id ?? null };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return normalizeUser(JSON.parse(localStorage.getItem("supportdesk_user") || "null"));
    } catch {
      return null;
    }
  });
  const [checking, setChecking] = useState(Boolean(localStorage.getItem("supportdesk_token")));

  const saveSession = useCallback((result) => {
    localStorage.setItem("supportdesk_token", result.token);
    const nextUser = normalizeUser(result.user);
    localStorage.setItem("supportdesk_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("supportdesk_token");
    localStorage.removeItem("supportdesk_user");
    setUser(null);
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setChecking(false);
    };
    window.addEventListener("supportdesk:session-expired", onExpired);
    return () => window.removeEventListener("supportdesk:session-expired", onExpired);
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("supportdesk_token");
    if (!token) {
      setChecking(false);
      return () => { active = false; };
    }
    authService.me()
      .then((rawUser) => {
        if (!active) return;
        const nextUser = normalizeUser(rawUser);
        localStorage.setItem("supportdesk_user", JSON.stringify(nextUser));
        setUser(nextUser);
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem("supportdesk_token");
        localStorage.removeItem("supportdesk_user");
        setUser(null);
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    checking,
    isAuthenticated: Boolean(user && localStorage.getItem("supportdesk_token")),
    login: async (credentials) => saveSession(await authService.login(credentials)),
    register: async (details) => saveSession(await authService.register(details)),
    logout
  }), [user, checking, saveSession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
