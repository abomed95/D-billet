import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { token, user, getAuthHeaders } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0, discount: 0, final_total: 0 });
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/cart`, {
        headers: getAuthHeaders()
      });
      setCart(response.data);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  }, [token, getAuthHeaders]);

  useEffect(() => {
    if (token && user) {
      fetchCart();
    } else {
      setCart({ items: [], total: 0, discount: 0, final_total: 0 });
    }
  }, [token, user, fetchCart]);

  const addToCart = async (eventId, ticketTypeId, quantity = 1, promoCode = null) => {
    if (!token) throw new Error('Veuillez vous connecter');
    
    await axios.post(`${API}/cart/add`, 
      { event_id: eventId, ticket_type_id: ticketTypeId, quantity, promo_code: promoCode },
      { headers: getAuthHeaders() }
    );
    await fetchCart();
  };

  const removeFromCart = async (eventId, ticketTypeId) => {
    if (!token) return;
    
    await axios.delete(`${API}/cart/${eventId}/${ticketTypeId}`, {
      headers: getAuthHeaders()
    });
    await fetchCart();
  };

  const applyPromoCode = async (code) => {
    if (!token) return;
    
    await axios.post(`${API}/cart/promo?promo_code=${code}`, {}, {
      headers: getAuthHeaders()
    });
    await fetchCart();
  };

  const clearCart = async () => {
    if (!token) return;
    
    await axios.delete(`${API}/cart`, {
      headers: getAuthHeaders()
    });
    setCart({ items: [], total: 0, discount: 0, final_total: 0 });
  };

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ 
      cart, loading,
      addToCart, removeFromCart, clearCart, fetchCart, 
      applyPromoCode,
      cartCount 
    }}>
      {children}
    </CartContext.Provider>
  );
};
