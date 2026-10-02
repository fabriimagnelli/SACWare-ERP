import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sacware_token';
const USER_KEY = 'sacware_usuario';

function leerTokenAlmacenado() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return token;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function leerUsuarioAlmacenado() {
  try {
    const crudo = localStorage.getItem(USER_KEY);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(leerTokenAlmacenado);
  const [usuario, setUsuario] = useState(() => (leerTokenAlmacenado() ? leerUsuarioAlmacenado() : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onLogout() {
      setToken(null);
      setUsuario(null);
    }
    window.addEventListener('sacware_logout', onLogout);
    return () => window.removeEventListener('sacware_logout', onLogout);
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (usuario) localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    else localStorage.removeItem(USER_KEY);
  }, [usuario]);

  async function login(email, password) {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setUsuario(data.usuario);
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo iniciar sesión. Revisa la conexión.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUsuario(null);
  }

  const value = useMemo(
    () => ({ token, usuario, isAuthenticated: Boolean(token), loading, error, login, logout }),
    [token, usuario, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
}
