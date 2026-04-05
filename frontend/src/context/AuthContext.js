import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dbillet_token'));
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check
    // AuthCallback will handle the session exchange
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const register = async (email, password, fullName) => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      full_name: fullName
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('dbillet_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, {
      email,
      password
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('dbillet_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const phoneLogin = async (phone, fullName = null) => {
    const response = await axios.post(`${API}/auth/phone-login`, { 
      phone,
      full_name: fullName 
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('dbillet_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const googleLogin = async (sessionId) => {
    const response = await axios.post(`${API}/auth/google/session`, {
      session_id: sessionId
    }, { withCredentials: true });
    const { token: accessToken, user: userData } = response.data;
    localStorage.setItem('dbillet_token', accessToken);
    setToken(accessToken);
    setUser(userData);
    return userData;
  };

  const createGuestSession = async (phone, fullName) => {
    const response = await axios.post(`${API}/auth/guest-session`, {
      phone,
      full_name: fullName
    });
    const { token: accessToken, user_id, full_name } = response.data;
    localStorage.setItem('dbillet_token', accessToken);
    setToken(accessToken);
    setUser({ id: user_id, phone, full_name, role: 'guest' });
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('dbillet_token');
    setToken(null);
    setUser(null);
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`
  });

  const isAdmin = user?.role === 'admin';
  const isOrganizer = ['organizer', 'admin', 'ferry_organizer', 'train_organizer'].includes(user?.role);
  const isFerryOrganizer = user?.role === 'ferry_organizer';
  const isTrainOrganizer = user?.role === 'train_organizer';
  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, 
      register, login, logout, 
      phoneLogin, googleLogin, createGuestSession,
      getAuthHeaders,
      isAdmin, isOrganizer, isFerryOrganizer, isTrainOrganizer, isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  );
};
