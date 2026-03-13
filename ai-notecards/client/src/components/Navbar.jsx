import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const planBadge = () => {
    if (!user) return null;
    if (user.plan === 'pro') {
      return (
        <span className="px-2 py-0.5 bg-gradient-to-r from-[#C8A84E] to-[#b8943e] text-white text-xs font-semibold rounded-full">
          PRO
        </span>
      );
    }
    if (user.plan === 'trial') {
      const daysLeft = user.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(user.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;
      return (
        <span className="px-2 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-semibold rounded-full">
          TRIAL · {daysLeft}d
        </span>
      );
    }
    return null;
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#1B6B5A] to-[#0d4a3d] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <span className="font-bold text-lg text-[#1A1614]">Notecards</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to="/marketplace"
                className="px-3 py-2 text-sm text-[#6B635A] hover:text-[#1A1614] transition-colors"
              >
                Marketplace
              </Link>
              <Link
                to="/generate"
                className="px-4 py-2 bg-[#1B6B5A] text-white rounded-lg text-sm font-medium hover:bg-[#155a4a] transition-colors"
              >
                + Generate
              </Link>
              <Link
                to="/dashboard"
                className="px-3 py-2 text-sm text-[#6B635A] hover:text-[#1A1614] transition-colors"
              >
                Decks
              </Link>
              {user.connect_charges_enabled && (
                <Link
                  to="/seller"
                  className="px-3 py-2 text-sm text-[#6B635A] hover:text-[#1A1614] transition-colors"
                >
                  Seller
                </Link>
              )}
              <div className="flex items-center gap-2 ml-2">
                {planBadge()}
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/marketplace"
                className="px-3 py-2 text-sm text-[#6B635A] hover:text-[#1A1614] transition-colors"
              >
                Marketplace
              </Link>
              <Link to="/login" className="px-3 py-2 text-sm text-[#6B635A] hover:text-[#1A1614]">
                Log in
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 bg-[#1B6B5A] text-white rounded-lg text-sm font-medium hover:bg-[#155a4a] transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
