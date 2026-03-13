import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DeckView from './pages/DeckView.jsx';
import Generate from './pages/Generate.jsx';
import Study from './pages/Study.jsx';
import Pricing from './pages/Pricing.jsx';
import Settings from './pages/Settings.jsx';
import Marketplace from './pages/Marketplace.jsx';
import MarketplaceDeck from './pages/MarketplaceDeck.jsx';
import ListDeck from './pages/ListDeck.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import Admin from './pages/Admin.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
        <div className="w-8 h-8 border-4 border-[#1B6B5A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1A1614', color: '#fff', borderRadius: '12px' },
        }}
      />
      <Routes>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/:id" element={<MarketplaceDeck />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/decks/:id" element={<ProtectedRoute><DeckView /></ProtectedRoute>} />
        <Route path="/generate" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
        <Route path="/study/:deckId" element={<ProtectedRoute><Study /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/sell/:deckId" element={<ProtectedRoute><ListDeck /></ProtectedRoute>} />
        <Route path="/seller" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
        <Route path="/admin/flags" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
