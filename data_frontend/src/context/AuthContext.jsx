import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://127.0.0.1:5000/api/auth';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('datalens_token');
    if (token) {
      fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('datalens_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    localStorage.setItem('datalens_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (signupData) => {
    const res = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Signup failed');

    localStorage.setItem('datalens_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (tokenResponse) => {
    // Note: If using useGoogleLogin, the token comes as 'access_token'. 
    // If using <GoogleLogin />, it comes as 'credential'.
    // We should send the ID token to the backend for verification.
    // If useGoogleLogin was used, it returns an access token which requires hitting Google's UserInfo endpoint first,
    // OR it can be configured to return an ID token by setting `flow: 'auth-code'` and handling it, but standard <GoogleLogin /> returns a JWT `credential`.
    // We'll assume we're passing the JWT `credential` (ID Token).
    const res = await fetch(`${API_URL}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenResponse }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Google Login failed');

    localStorage.setItem('datalens_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('datalens_token');
    setUser(null);
    navigate('/');
  }, [navigate]);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
