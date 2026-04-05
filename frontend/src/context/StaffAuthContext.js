import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STAFF_TOKEN_KEY = 'staff_token';

// Secure token storage helpers
const getStoredToken = () => {
  try {
    return sessionStorage.getItem(STAFF_TOKEN_KEY) || localStorage.getItem(STAFF_TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token) => {
  try {
    sessionStorage.setItem(STAFF_TOKEN_KEY, token);
    localStorage.setItem(STAFF_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store staff token:', error);
  }
};

const clearStoredToken = () => {
  try {
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear staff token:', error);
  }
};

const StaffAuthContext = createContext(null);

export const StaffAuthProvider = ({ children }) => {
  const [staff, setStaff] = useState(null);
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setStaff(null);
  }, []);

  const verifyToken = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/staff/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(response.data);
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const login = useCallback(async (username, password) => {
    const response = await axios.post(`${API}/staff/login`, { username, password });
    const { access_token, staff: staffData } = response.data;
    
    storeToken(access_token);
    setToken(access_token);
    setStaff(staffData);
    
    return staffData;
  }, []);

  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const contextValue = useMemo(() => ({
    staff,
    token,
    loading,
    login,
    logout,
    getAuthHeaders,
    isAuthenticated: !!staff
  }), [staff, token, loading, login, logout, getAuthHeaders]);

  return (
    <StaffAuthContext.Provider value={contextValue}>
      {children}
    </StaffAuthContext.Provider>
  );
};

export const useStaffAuth = () => {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error('useStaffAuth must be used within StaffAuthProvider');
  }
  return context;
};
