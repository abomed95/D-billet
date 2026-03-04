import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StaffAuthContext = createContext(null);

export const StaffAuthProvider = ({ children }) => {
  const [staff, setStaff] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('staff_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
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
  };

  const login = async (username, password) => {
    const response = await axios.post(`${API}/staff/login`, { username, password });
    const { access_token, staff: staffData } = response.data;
    
    localStorage.setItem('staff_token', access_token);
    setToken(access_token);
    setStaff(staffData);
    
    return staffData;
  };

  const logout = () => {
    localStorage.removeItem('staff_token');
    setToken(null);
    setStaff(null);
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`
  });

  return (
    <StaffAuthContext.Provider value={{
      staff,
      token,
      loading,
      login,
      logout,
      getAuthHeaders,
      isAuthenticated: !!staff
    }}>
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
