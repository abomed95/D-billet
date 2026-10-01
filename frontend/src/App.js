import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { StaffAuthProvider } from "./context/StaffAuthContext";
import Seo from "./components/Seo";

// Public pages stay eagerly imported: react-snap prerenders them, and a
// deferred chunk would leave the prerendered HTML out of step with
// hydration.
import HomePage from "./pages/HomePage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import TicketViewPage from "./pages/TicketViewPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import AuthPage from "./pages/AuthPage";
import TrainBookingPage from "./pages/TrainBookingPage";
import FerryBookingPage from "./pages/FerryBookingPage";
import TermsPage from "./pages/TermsPage";
import LegalPage from "./pages/LegalPage";
import NotFoundPage from "./pages/NotFoundPage";

// Layout
import MainLayout from "./layouts/MainLayout";

// Admin area. These share one chunk name so the whole area arrives in a
// single request instead of nine: latency hurts more than bytes on 3G.
const AdminDashboard = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminDashboard")
);
const AdminEvents = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminEvents")
);
const AdminScanner = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminScanner")
);
const AdminOrganizers = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminOrganizers")
);
const AdminUsers = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminUsers")
);
const AdminTransactions = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminTransactions")
);
const AdminPayouts = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminPayouts")
);
const AdminSettings = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminSettings")
);
const AdminTransport = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./pages/admin/AdminTransport")
);
const AdminLayout = lazy(() =>
  import(/* webpackChunkName: "admin" */ "./layouts/AdminLayout")
);

// Organizer area, one chunk.
const OrganizerDashboard = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerDashboard")
);
const OrganizerEvents = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerEvents")
);
const OrganizerPromoCodes = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerPromoCodes")
);
const OrganizerParticipants = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerParticipants")
);
const OrganizerFinances = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerFinances")
);
const OrganizerStaff = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerStaff")
);
const OrganizerLiveDashboard = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/OrganizerLiveDashboard")
);
const TransportOrganizerDashboard = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./pages/organizer/TransportOrganizerDashboard")
);
const OrganizerLayout = lazy(() =>
  import(/* webpackChunkName: "organizer" */ "./layouts/OrganizerLayout")
);

// Scanners (staff and security), one chunk.
const StaffLoginPage = lazy(() =>
  import(/* webpackChunkName: "scanner" */ "./pages/staff/StaffLoginPage")
);
const StaffScannerPage = lazy(() =>
  import(/* webpackChunkName: "scanner" */ "./pages/staff/StaffScannerPage")
);
const ScannerPage = lazy(() =>
  import(/* webpackChunkName: "scanner" */ "./pages/ScannerPage")
);

// Shown while an area chunk is still on the wire, and while the session is
// being restored. Identical markup in both cases, so a slow connection does
// not flash one layout and then another.
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#050505] flex items-center justify-center">
    <div className="text-center">
      <div className="font-unbounded font-bold text-3xl bg-gradient-to-r from-gold to-yellow-300 bg-clip-text text-transparent mb-2">D-BILLET</div>
      <div className="animate-pulse text-gray-400">Chargement...</div>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, organizerOnly = false }) => {
  const { user, loading, isAdmin, isOrganizer } = useAuth();

  if (loading) {
    return <LoadingScreen />;
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

function RouteMetadata() {
  const location = useLocation();
  const pathname = location.pathname;
  const noIndexPrefixes = ["/admin", "/organizer", "/staff", "/controle"];
  const noIndexExact = ["/auth", "/cart", "/checkout", "/payment/result", "/my-tickets", "/scan", "/transport-organizer"];
  const isNoIndex =
    noIndexExact.includes(pathname) ||
    noIndexPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith("/ticket/");

  if (!isNoIndex) {
    return null;
  }

  return (
    <Seo
      title="Espace prive"
      description="Section privee de D-Billet reservee a l'authentification, aux achats ou a l'administration."
      path={pathname}
      robots="noindex, nofollow, noarchive"
    />
  );
}

function AppRoutes() {
  return (
    <>
      <RouteMetadata />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="event/:id" element={<EventDetailPage />} />
          <Route path="events/:id/:slug" element={<EventDetailPage />} />
          <Route path="auth" element={<AuthPage />} />
          <Route path="train" element={<TrainBookingPage />} />
          <Route path="ferry" element={<FerryBookingPage />} />
          <Route path="ticket/:id" element={<TicketViewPage />} />
          <Route path="payment/result" element={<PaymentResultPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="legal/:page" element={<LegalPage />} />
          <Route path="privacy" element={<Navigate to="/legal/privacy" replace />} />
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
        {/* The mission names this screen /controle; /staff/scanner is kept so
            existing bookmarks and the login redirect keep working. */}
        <Route path="/controle" element={<StaffAuthProvider><StaffScannerPage /></StaffAuthProvider>} />
        <Route path="/controle/login" element={<StaffAuthProvider><StaffLoginPage /></StaffAuthProvider>} />
        
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
        
        <Route path="404" element={<NotFoundPage />} />

        {/* Catch all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Suspense fallback={<LoadingScreen />}>
            <AppRoutes />
          </Suspense>
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
