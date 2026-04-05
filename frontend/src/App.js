import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { StaffAuthProvider } from "./context/StaffAuthContext";

// Pages
import HomePage from "./pages/HomePage";
import EventDetailPage from "./pages/EventDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import TicketViewPage from "./pages/TicketViewPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import AuthPage from "./pages/AuthPage";
import TrainBookingPage from "./pages/TrainBookingPage";
import FerryBookingPage from "./pages/FerryBookingPage";
import ScannerPage from "./pages/ScannerPage";
import TermsPage from "./pages/TermsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminScanner from "./pages/admin/AdminScanner";
import AdminOrganizers from "./pages/admin/AdminOrganizers";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminTransport from "./pages/admin/AdminTransport";
import OrganizerDashboard from "./pages/organizer/OrganizerDashboard";
import OrganizerEvents from "./pages/organizer/OrganizerEvents";
import OrganizerPromoCodes from "./pages/organizer/OrganizerPromoCodes";
import OrganizerParticipants from "./pages/organizer/OrganizerParticipants";
import OrganizerFinances from "./pages/organizer/OrganizerFinances";
import OrganizerStaff from "./pages/organizer/OrganizerStaff";
import OrganizerLiveDashboard from "./pages/organizer/OrganizerLiveDashboard";
import TransportOrganizerDashboard from "./pages/organizer/TransportOrganizerDashboard";
import StaffLoginPage from "./pages/staff/StaffLoginPage";
import StaffScannerPage from "./pages/staff/StaffScannerPage";

// Layout
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import OrganizerLayout from "./layouts/OrganizerLayout";

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, organizerOnly = false }) => {
  const { user, loading, isAdmin, isOrganizer } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="font-unbounded font-bold text-3xl bg-gradient-to-r from-gold to-yellow-300 bg-clip-text text-transparent mb-2">D-BILLEH</div>
          <div className="animate-pulse text-gray-400">Chargement...</div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Admin only routes - STRICT: only admin role
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  // Organizer only routes - organizer OR admin can access
  if (organizerOnly && !isOrganizer) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="event/:id" element={<EventDetailPage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="train" element={<TrainBookingPage />} />
        <Route path="ferry" element={<FerryBookingPage />} />
        <Route path="ticket/:id" element={<TicketViewPage />} />
        <Route path="terms" element={<TermsPage />} />
      </Route>
      
      {/* Scanner - Separate Public App */}
      <Route path="/scan" element={<ScannerPage />} />
      
      {/* Protected User Routes */}
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="my-tickets" element={<MyTicketsPage />} />
      </Route>
      
      {/* Organizer Routes */}
      <Route path="/organizer" element={<ProtectedRoute organizerOnly><OrganizerLayout /></ProtectedRoute>}>
        <Route index element={<OrganizerDashboard />} />
        <Route path="events" element={<OrganizerEvents />} />
        <Route path="participants" element={<OrganizerParticipants />} />
        <Route path="promo-codes" element={<OrganizerPromoCodes />} />
        <Route path="finances" element={<OrganizerFinances />} />
        <Route path="staff" element={<OrganizerStaff />} />
      </Route>
      
      {/* Organizer Live Dashboard (Full Screen) */}
      <Route path="/organizer/live/:eventId" element={<ProtectedRoute organizerOnly><OrganizerLiveDashboard /></ProtectedRoute>} />
      
      {/* Transport Organizer Dashboard */}
      <Route path="/transport-organizer" element={<ProtectedRoute organizerOnly><TransportOrganizerDashboard /></ProtectedRoute>} />
      
      {/* Staff Routes - Separate Auth Context */}
      <Route path="/staff/login" element={<StaffAuthProvider><StaffLoginPage /></StaffAuthProvider>} />
      <Route path="/staff/scanner" element={<StaffAuthProvider><StaffScannerPage /></StaffAuthProvider>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="transport" element={<AdminTransport />} />
        <Route path="scanner" element={<AdminScanner />} />
        <Route path="organizers" element={<AdminOrganizers />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
          <Toaster 
            position="top-center" 
            richColors 
            toastOptions={{
              style: {
                background: '#0A0A0F',
                border: '1px solid rgba(0,255,148,0.2)',
                color: '#fff'
              }
            }}
          />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
