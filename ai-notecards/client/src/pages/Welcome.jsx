import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

export default function Welcome() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await api.updateProfile({ displayName: name });
      await refreshUser();
      toast.success('Welcome aboard!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50/30 to-gray-50">
      <Navbar />
      <div className="flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to AI Notecards</h1>
            <p className="text-gray-500 mb-8">What should we call you?</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                  placeholder="Your name"
                  autoFocus
                  maxLength={50}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !displayName.trim()}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </form>

            <p className="mt-4 text-center">
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-gray-500"
              >
                Skip for now
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
