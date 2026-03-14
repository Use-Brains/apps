import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

function AvatarDropdown({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Click outside closes dropdown (mousedown to prevent toggle-bounce)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape key closes dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const initials = user.display_name
    ? user.display_name.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();

  const planBadge = () => {
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
    <div className="relative">
      <button
        ref={buttonRef}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#1B6B5A] text-white text-sm font-medium flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#1B6B5A]/30 transition-shadow overflow-hidden"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Account menu" ref={menuRef}
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50"
        >
          {/* User info */}
          <div className="px-4 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[#1A1614] truncate">
                {user.display_name || user.email}
              </p>
              {planBadge()}
            </div>
            {user.display_name && (
              <p className="text-xs text-[#6B635A] truncate mt-0.5">{user.email}</p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              role="menuitem"
              to="/profile"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-4 py-2.5 text-sm text-[#1A1614] hover:bg-[#FAF7F2] transition-colors"
            >
              Profile
            </Link>
            <Link
              role="menuitem"
              to="/settings"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-4 py-2.5 text-sm text-[#1A1614] hover:bg-[#FAF7F2] transition-colors"
            >
              Settings
            </Link>
            {user.connect_charges_enabled && (
              <Link
                role="menuitem"
                to="/seller"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-[#1A1614] hover:bg-[#FAF7F2] transition-colors"
              >
                Seller Dashboard
              </Link>
            )}
          </div>

          {/* Divider + logout */}
          <div className="my-1 border-t border-gray-100" />
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onLogout(); }}
            className="block w-full text-left px-4 py-2.5 text-sm text-[#6B635A] hover:bg-[#FAF7F2] transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
              <AvatarDropdown user={user} onLogout={handleLogout} />
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
