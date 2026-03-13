import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProfile().then((data) => {
      setDisplayName(data.profile.display_name || '');
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({ display_name: displayName });
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your Pro subscription? You\'ll keep access until the end of your billing period.')) return;
    try {
      await api.cancelSubscription();
      toast.success('Subscription will cancel at end of billing period');
      await refreshUser();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-[#1A1614] mb-8">Settings</h1>

        {/* Profile */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#6B635A] mb-1">Email</label>
              <p className="text-[#1A1614]">{user?.email}</p>
            </div>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-[#6B635A] mb-1">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your public name on the marketplace"
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </section>

        {/* Subscription */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Subscription</h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[#1A1614] font-medium capitalize">{user?.plan} plan</span>
            {user?.plan === 'trial' && user?.trial_ends_at && (
              <span className="text-sm text-[#6B635A]">
                · Trial ends {new Date(user.trial_ends_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {user?.plan === 'pro' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              Cancel subscription
            </button>
          )}
          {(user?.plan === 'free' || user?.plan === 'trial') && (
            <a
              href="/pricing"
              className="inline-block px-4 py-2 text-sm text-[#1B6B5A] border border-[#1B6B5A]/30 rounded-xl hover:bg-[#E8F5F0] transition-colors"
            >
              {user?.plan === 'trial' ? 'Subscribe to Pro' : 'Upgrade to Pro'}
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
