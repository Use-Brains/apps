import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

function SellerTermsModal({ onAccept, onClose }) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await api.acceptSellerTerms();
      await onAccept();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-lg font-bold text-[#1A1614] mb-1">Become a Seller</h2>
        <p className="text-sm text-[#6B635A] mb-4">Before you start selling, please review and accept the following:</p>
        <ul className="space-y-2 mb-5 text-sm text-[#1A1614]">
          <li className="flex gap-2">
            <span className="text-[#1B6B5A] shrink-0">&#x2022;</span>
            You are responsible for all content you list, including AI-generated content
          </li>
          <li className="flex gap-2">
            <span className="text-[#1B6B5A] shrink-0">&#x2022;</span>
            Review your full deck before listing — make sure it's accurate and complete
          </li>
          <li className="flex gap-2">
            <span className="text-[#1B6B5A] shrink-0">&#x2022;</span>
            Clean, well-organized notecards sell better and get higher ratings
          </li>
          <li className="flex gap-2">
            <span className="text-[#1B6B5A] shrink-0">&#x2022;</span>
            We reserve the right to remove listings that violate our content guidelines
          </li>
        </ul>
        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#1B6B5A] focus:ring-[#1B6B5A]"
          />
          <span className="text-sm text-[#1A1614] font-medium">I understand and agree</span>
        </label>
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            disabled={!agreed || submitting}
            className="flex-1 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50 text-sm"
          >
            {submitting ? 'Setting up...' : 'Continue'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[#6B635A] text-sm hover:text-[#1A1614] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

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

  const handleSellerOnboard = async () => {
    try {
      await refreshUser();
      const data = await api.startSellerOnboarding();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleFinishSetup = async () => {
    setOnboarding(true);
    try {
      const data = await api.startSellerOnboarding();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOnboarding(false);
    }
  };

  const isPro = user?.plan === 'pro';
  const hasAcceptedTerms = !!user?.seller_terms_accepted_at;
  const isActiveSeller = hasAcceptedTerms && user?.connect_charges_enabled;
  const needsConnectSetup = hasAcceptedTerms && !user?.connect_charges_enabled;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      {showTermsModal && (
        <SellerTermsModal
          onAccept={handleSellerOnboard}
          onClose={() => setShowTermsModal(false)}
        />
      )}
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
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
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

        {/* Seller */}
        {isPro && (
          <section className="bg-white rounded-2xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Seller</h2>
            {isActiveSeller && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-medium rounded">Active Seller</span>
                </div>
                <p className="text-sm text-[#6B635A] mb-4">
                  Your Stripe account is connected and you can sell decks on the marketplace.
                </p>
                <Link
                  to="/seller"
                  className="inline-block px-4 py-2 text-sm text-[#1B6B5A] border border-[#1B6B5A]/30 rounded-xl hover:bg-[#E8F5F0] transition-colors"
                >
                  View Seller Dashboard
                </Link>
              </div>
            )}
            {needsConnectSetup && (
              <div>
                <p className="text-sm text-[#6B635A] mb-4">
                  You've accepted the seller terms. Complete your Stripe setup to start selling.
                </p>
                <button
                  onClick={handleFinishSetup}
                  disabled={onboarding}
                  className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors disabled:opacity-50 text-sm"
                >
                  {onboarding ? 'Redirecting to Stripe...' : 'Finish Stripe Setup'}
                </button>
              </div>
            )}
            {!hasAcceptedTerms && (
              <div>
                <p className="text-sm text-[#6B635A] mb-4">
                  Earn money by selling your flashcard decks on the marketplace.
                </p>
                <button
                  onClick={() => setShowTermsModal(true)}
                  className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors text-sm"
                >
                  Become a Seller
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
