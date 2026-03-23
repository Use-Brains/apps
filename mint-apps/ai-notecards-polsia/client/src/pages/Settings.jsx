import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import { analytics, updateConsent } from '../lib/analytics.js';
import { getSellerToolsMode } from '../lib/runtime.js';
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
        <p className="text-xs text-[#6B635A] mb-4">
          See our full{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#1B6B5A] hover:underline">Terms of Service</a>
          {' '}for details.
        </p>
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

function DeleteConfirmModal({ onConfirm, onClose, busy }) {
  const [typed, setTyped] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[#1A1614] mb-2">Delete Account</h2>
        <p className="text-sm text-[#6B635A] mb-1">
          This action is permanent. All your data will be erased and cannot be recovered.
        </p>
        <p className="text-sm text-[#6B635A] mb-4">
          Type <strong>DELETE</strong> to confirm.
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type DELETE"
          className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(typed)}
            disabled={typed !== 'DELETE' || busy}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete my account'}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-3 text-[#6B635A] text-sm hover:text-[#1A1614] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-[#1B6B5A]' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        checked ? 'translate-x-4' : ''
      }`} />
    </button>
  );
}

export default function Settings() {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const sellerToolsMode = getSellerToolsMode(user);
  const navigate = useNavigate();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Preferences state
  const [prefs, setPrefs] = useState({ auto_flip_seconds: 0, notifications: { study_reminders: true, marketplace_activity: true } });
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(null);

  // Data & Privacy state
  const [busyAction, setBusyAction] = useState(null); // null | 'exporting' | 'deleting'
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(user?.preferences?.analytics_opt_out ?? true);
  const [analyticsToggling, setAnalyticsToggling] = useState(false);

  // Portal return flow — refresh user after returning from Stripe
  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal_return') === 'true') {
      window.history.replaceState({}, '', '/settings');
      refreshUser().catch(() => {
        toast.error('Could not refresh your account. Please reload.');
      });
    }
  }, [authLoading]);

  useEffect(() => {
    if (user?.preferences) {
      setPrefs(prev => ({
        ...prev,
        ...user.preferences,
        notifications: { ...prev.notifications, ...(user.preferences.notifications || {}) },
      }));
    }
  }, [user?.preferences]);

  // Debounced auto-save for preferences
  const savePreferences = (updatedPrefs) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (savingRef.current) {
        pendingRef.current = updatedPrefs;
        return;
      }
      savingRef.current = true;
      try {
        await api.updatePreferences(updatedPrefs);
      } catch {
        toast.error('Failed to save preferences');
      } finally {
        savingRef.current = false;
        if (pendingRef.current) {
          const next = pendingRef.current;
          pendingRef.current = null;
          savePreferences(next);
        }
      }
    }, 300);
  };

  const updatePref = (key, value) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    savePreferences({ [key]: value });
  };

  const updateNotification = (key, value) => {
    const updated = { ...prefs, notifications: { ...prefs.notifications, [key]: value } };
    setPrefs(updated);
    savePreferences({ notifications: { [key]: value } });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setChangingPassword(true);
    try {
      await api.changePassword(null, newPassword);
      toast.success('Password set successfully');
      refreshUser();
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExport = async () => {
    setBusyAction('exporting');
    try {
      const res = await api.exportDecks();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notecards-export.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteAccount = async (confirmation) => {
    setBusyAction('deleting');
    try {
      await api.deleteAccount(confirmation);
      toast.success('Account deleted');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyAction(null);
      setShowDeleteModal(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your Pro subscription? You\'ll keep access until the end of your billing period.')) return;
    try {
      const result = await api.cancelSubscription();
      if (result.status === 'unavailable') {
        toast(result.message);
        return;
      }
      toast.success('Subscription will cancel at end of billing period');
      await refreshUser();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAnalyticsToggle = async (optOut) => {
    setAnalyticsToggling(true);
    try {
      await api.updatePreferences({ analytics_opt_out: optOut });
      // Only update local state after server confirms
      setAnalyticsOptOut(optOut);
      updateConsent(!optOut);
      if (optOut) { analytics.optOut(); }
      else { analytics.optIn(); }
      toast.success(optOut ? 'Analytics disabled' : 'Analytics enabled');
    } catch {
      toast.error('Failed to update preference');
    } finally {
      setAnalyticsToggling(false);
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
  const subscriptionPlatform = user?.subscription_platform || 'stripe';

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      {showTermsModal && (
        <SellerTermsModal
          onAccept={handleSellerOnboard}
          onClose={() => setShowTermsModal(false)}
        />
      )}
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteAccount}
          onClose={() => setShowDeleteModal(false)}
          busy={busyAction === 'deleting'}
        />
      )}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-[#1A1614] mb-8">Settings</h1>

        {/* Security */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Security</h2>

          {user?.has_password ? (
            <form onSubmit={handlePasswordChange} className="space-y-3 mb-4">
              <h3 className="text-sm font-medium text-[#1A1614]">Change Password</h3>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                required
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                required
                minLength={8}
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
              <button
                type="submit"
                disabled={changingPassword}
                className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors disabled:opacity-50 text-sm"
              >
                {changingPassword ? 'Changing...' : 'Change password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-3 mb-4">
              <h3 className="text-sm font-medium text-[#1A1614]">Set Password</h3>
              <p className="text-xs text-[#6B635A]">
                Add a password to your account. You can always sign in with email code or Google instead.
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                required
                minLength={8}
                maxLength={128}
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                minLength={8}
                maxLength={128}
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
              <button
                type="submit"
                disabled={changingPassword}
                className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors disabled:opacity-50 text-sm"
              >
                {changingPassword ? 'Setting...' : 'Set password'}
              </button>
            </form>
          )}

          {/* Connected Accounts */}
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-sm font-medium text-[#1A1614] mb-2">Connected Accounts</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6B635A]">Google</span>
              {user?.google_connected ? (
                <span className="px-2 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-medium rounded">Connected</span>
              ) : (
                <span className="px-2 py-0.5 bg-gray-100 text-[#6B635A] text-xs font-medium rounded">Not connected</span>
              )}
            </div>
          </div>
        </section>

        {/* Study Preferences */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Study Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1A1614] mb-2">Auto-flip Timer</label>
              <select
                value={prefs.auto_flip_seconds}
                onChange={(e) => updatePref('auto_flip_seconds', Number(e.target.value))}
                className="px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              >
                <option value={0}>Off</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1A1614] mb-2">Daily Study Goal</label>
              <select
                value={prefs.daily_goal || 20}
                onChange={(e) => updatePref('daily_goal', Number(e.target.value))}
                className="px-4 py-2.5 bg-[#FAF7F2] border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              >
                {[5, 10, 15, 20, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} sessions</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-1">Notifications</h2>
          <p className="text-xs text-[#6B635A] mb-4">Email delivery coming soon</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#1A1614]">Study reminders</span>
              <Toggle
                checked={prefs.notifications.study_reminders}
                onChange={(v) => updateNotification('study_reminders', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#1A1614]">Marketplace activity</span>
              <Toggle
                checked={prefs.notifications.marketplace_activity}
                onChange={(v) => updateNotification('marketplace_activity', v)}
              />
            </div>
          </div>
        </section>

        {/* Subscription */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Subscription</h2>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 mb-4">
            <p className="text-sm font-medium text-[#1A1614] mb-1">Billing is a placeholder in this handoff build</p>
            <p className="text-sm text-[#6B635A]">Upgrade, billing portal, and cancellation actions will return a coming-soon response until Polsia wires the payment system.</p>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[#1A1614] font-medium capitalize">{user?.plan} plan</span>
            {user?.plan === 'trial' && user?.trial_ends_at && (
              <span className="text-sm text-[#6B635A]">
                · Trial ends {new Date(user.trial_ends_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {user?.cancel_at_period_end && user?.cancel_at && (
            <p className="text-sm text-[#6B635A] mb-4">
              Your subscription will cancel on {new Date(user.cancel_at).toLocaleDateString()}.
              You'll retain Pro access until then.
            </p>
          )}
          {user?.plan === 'pro' && (
            <div className="flex gap-3">
              {subscriptionPlatform === 'apple' ? (
                <a
                  href="https://apps.apple.com/account/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm text-[#1B6B5A] border border-[#1B6B5A]/30 rounded-xl hover:bg-[#E8F5F0] transition-colors"
                >
                  Manage in Apple
                </a>
              ) : user?.has_billing_account ? (
                <button
                  onClick={async () => {
                    setPortalLoading(true);
                    try {
                      const data = await api.createBillingPortal();
                      if (data.status === 'unavailable') {
                        toast(data.message);
                        setPortalLoading(false);
                        return;
                      }
                      window.location.href = data.url;
                    } catch (err) {
                      toast.error(err.message);
                      setPortalLoading(false);
                    }
                  }}
                  disabled={portalLoading}
                  className="px-4 py-2 text-sm text-[#1B6B5A] border border-[#1B6B5A]/30 rounded-xl hover:bg-[#E8F5F0] transition-colors disabled:opacity-50"
                >
                  {portalLoading ? 'Redirecting to Stripe...' : 'Manage Billing'}
                </button>
              ) : null}
              {subscriptionPlatform !== 'apple' && !user?.cancel_at_period_end && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                >
                  Cancel subscription
                </button>
              )}
            </div>
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
          <section className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
            <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Seller</h2>
            {!sellerToolsMode.enabled && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-sm font-medium text-[#1A1614] mb-1">Seller tools are read-only here</p>
                <p className="text-sm text-[#6B635A] mb-2">{sellerToolsMode.message}</p>
                <p className="text-sm text-[#6B635A]">
                  Existing seller state stays visible in the account model, but onboarding, listing management, and payout actions are disabled in this deployment.
                </p>
              </div>
            )}
            {sellerToolsMode.enabled && isActiveSeller && (
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
            {sellerToolsMode.enabled && needsConnectSetup && (
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
            {sellerToolsMode.enabled && !hasAcceptedTerms && (
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

        {/* Data & Privacy */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1A1614] mb-4">Data & Privacy</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-sm text-[#1A1614]">Analytics</span>
                <p className="text-xs text-[#6B635A] mt-0.5">Help us improve by sharing anonymous usage data</p>
              </div>
              <Toggle
                checked={!analyticsOptOut}
                onChange={(enabled) => handleAnalyticsToggle(!enabled)}
                disabled={analyticsToggling}
              />
            </div>
            <div>
              <p className="text-sm text-[#6B635A] mb-2">Download all your decks and flashcards as a JSON file.</p>
              <button
                onClick={handleExport}
                disabled={busyAction !== null}
                className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors disabled:opacity-50 text-sm"
              >
                {busyAction === 'exporting' ? 'Exporting...' : 'Export my data'}
              </button>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-[#6B635A] mb-2">Permanently delete your account and all associated data.</p>
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={busyAction !== null}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
              >
                Delete account
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
