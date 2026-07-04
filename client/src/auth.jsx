import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then(({ user, business }) => {
        setUser(user);
        setBusiness(business);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
    return data;
  }, []);

  const register = useCallback(async (form) => {
    const data = await api('/auth/register', { method: 'POST', body: form, auth: false });
    setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, business, setBusiness, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
