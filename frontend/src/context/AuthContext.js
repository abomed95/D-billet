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

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

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

  const sendOtp = async (phone) => {
    const response = await axios.post(`${API}/auth/otp/send`, { phone });
    return response.data;
  };

  const verifyOtp = async (phone, otp) => {
    const response = await axios.post(`${API}/auth/otp/verify`, { phone, otp });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('dbillet_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('dbillet_token');
    setToken(null);
    setUser(null);
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`
  });

  const isAdmin = user?.role === 'admin';
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, 
      register, login, logout, 
      sendOtp, verifyOtp,
      getAuthHeaders,
      isAdmin, isOrganizer
    }}>
      {children}
    </AuthContext.Provider>
  );
};
