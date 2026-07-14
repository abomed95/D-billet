import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Use sessionStorage instead of localStorage for better security
// Token is cleared when browser tab closes
const TOKEN_KEY = 'dbillet_token';

const getStoredToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token) => {
  try {
    // Store in sessionStorage (cleared on tab close) for better security
    sessionStorage.setItem(TOKEN_KEY, token);
    // Also store in localStorage for "remember me" functionality
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store token:', error);
  }
};

const clearStoredToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear token:', error);
  }
};

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
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
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
  }, [token, logout]);

  useEffect(() => {
    // Wait for the auth page to consume OAuth callback fragments first.
    if (
      window.location.hash?.includes('token=') ||
      window.location.hash?.includes('google_error=')
    ) {
      setLoading(false);
      return;
    }

    fetchUser();
  }, [fetchUser]);

  const register = useCallback(async (email, password, fullName) => {
    const response = await axios.post(`${API}/auth/register`, {
      email,
      password,
      full_name: fullName
    }, { withCredentials: true });
    const { access_token, user: userData } = response.data;
    storeToken(access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, {
      email,
      password
    }, { withCredentials: true });
    const { access_token, user: userData } = response.data;
    storeToken(access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const phoneLogin = useCallback(async (phone, fullName = null) => {
    const response = await axios.post(`${API}/auth/phone-login`, { 
      phone,
      full_name: fullName 
    }, { withCredentials: true });
    const { access_token, user: userData } = response.data;
    storeToken(access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const completeOAuthLogin = useCallback(async (accessToken) => {
    storeToken(accessToken);
    setToken(accessToken);

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true
      });
      setUser(response.data);
      return response.data;
    } catch (error) {
      clearStoredToken();
      setToken(null);
      setUser(null);
      throw error;
    }
  }, []);

  const createGuestSession = useCallback(async (phone, fullName) => {
    const response = await axios.post(`${API}/auth/guest-session`, {
      phone,
      full_name: fullName
    }, { withCredentials: true });
    const { token: accessToken, user_id, full_name } = response.data;
    storeToken(accessToken);
    setToken(accessToken);
    setUser({ id: user_id, phone, full_name, role: 'guest' });
    return response.data;
  }, []);

  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  // Memoize computed values
  const authState = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isOrganizer: ['organizer', 'admin', 'ferry_organizer', 'train_organizer'].includes(user?.role),
    isFerryOrganizer: user?.role === 'ferry_organizer',
    isTrainOrganizer: user?.role === 'train_organizer',
    isAuthenticated: !!user && !!token
  }), [user, token]);

  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    register,
    login,
    logout,
    phoneLogin,
    completeOAuthLogin,
    createGuestSession,
    getAuthHeaders,
    ...authState
  }), [user, token, loading, register, login, logout, phoneLogin, completeOAuthLogin, createGuestSession, getAuthHeaders, authState]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
