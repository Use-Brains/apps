import { useState } from 'react';
import { initPostHog, analytics, updateConsent } from '../lib/analytics.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function ConsentBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('analytics_consent') === null;
  });

  if (!visible) return null;

  const handleAccept = () => {
    updateConsent(true);
    initPostHog().then((ph) => {
      if (!ph) return;
      ph.opt_in_capturing();
      // Replay identity — user may already be logged in before consent
      if (user) {
        ph.identify(user.id, {
          plan: user.plan,
          signup_date: user.created_at,
          is_seller: !!user.seller_terms_accepted_at,
        });
      }
    });
    // Sync to server (fire-and-forget)
    api.updatePreferences({ analytics_opt_out: false }).catch(() => {});
    setVisible(false);
  };

  const handleDecline = () => {
    updateConsent(false);
    api.updatePreferences({ analytics_opt_out: true }).catch(() => {});
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-lg mx-auto bg-[#1A1614] text-white rounded-2xl p-5 shadow-xl">
        <p className="text-sm mb-4">
          We use cookies and analytics to improve your experience. You can opt out anytime in Settings.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 py-2 bg-[#1B6B5A] text-white rounded-xl text-sm font-medium hover:bg-[#155a4a] transition-colors"
          >
            Accept
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
