import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionUser } from '@ust/shared';
import { apiGet, apiPost, setUnauthorizedHandler } from '../api/client';

interface AuthState {
  user: SessionUser | null;
  checking: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    apiGet<{ user: SessionUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await apiPost<{ user: SessionUser }>('/auth/login', { email, password });
    setUser(r.user);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const r = await apiPost<{ user: SessionUser }>('/auth/signup', { email, password });
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    await apiPost('/auth/logout').catch(() => undefined);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, checking, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/** Like useAuth, but returns null outside AuthProvider (the demo build). */
export const useOptionalAuth = () => useContext(Ctx);
