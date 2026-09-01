import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  // A 401 from any request means the token is gone or stale — drop it.
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restore the session on first load.
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user: u }) => setUser(u))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const authenticate = async (fn, payload) => {
    const { token, user: u } = await fn(payload);
    localStorage.setItem('token', token);
    setUser(u);
    return u;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (payload) => authenticate(api.login, payload),
      register: (payload) => authenticate(api.register, payload),
      logout,
    }),
    [user, loading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
