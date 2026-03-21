import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';

const FREE_FEATURES = [
  '1 AI generation per day',
  'Up to 10 decks',
  'Browse & buy marketplace decks',
  'Full study mode',
  'Progress tracking',
];

const PRO_FEATURES = [
  '10 AI generations per day',
  'Unlimited decks',
  'Sell decks on marketplace',
  'Seller dashboard & analytics',
  'Everything in Free',
];

export default function Pricing() {
  const { user } = useAuth();
  const annualPrice = '$79.99';

  const handleUpgrade = async (billingPeriod = 'monthly') => {
    try {
      const data = await api.createCheckout(billingPeriod);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  const isTrialActive = user?.plan === 'trial' && user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();
  const trialDaysLeft = isTrialActive
    ? Math.ceil((new Date(user.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-center text-[#1A1614] mb-4">Choose your plan</h1>
        <p className="text-center text-[#6B635A] mb-4 max-w-lg mx-auto">
          Start with a free 7-day Pro trial. No credit card required.
        </p>
        {isTrialActive && (
          <p className="text-center text-[#1B6B5A] font-medium mb-8">
            Your trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mt-8">
          {/* Free */}
          <div className={`bg-white rounded-2xl p-8 border shadow-sm ${user?.plan === 'free' ? 'border-[#1B6B5A] ring-2 ring-[#E8F5F0]' : 'border-gray-200'}`}>
            {user?.plan === 'free' && (
              <span className="inline-block px-3 py-1 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-semibold rounded-full mb-4">
                Current plan
              </span>
            )}
            <h3 className="text-lg font-semibold text-[#1A1614]">Free</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-[#1A1614]">$0</span>
              <span className="text-[#6B635A]">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-[#6B635A]">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[#2D8A5E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                to="/login"
                className="mt-8 block text-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Get started
              </Link>
            ) : (
              <div className="mt-8 block text-center px-6 py-3 bg-gray-50 text-gray-400 rounded-xl font-medium">
                {user.plan === 'free' ? 'Current plan' : 'Free tier'}
              </div>
            )}
          </div>

          {/* Pro */}
          <div className={`rounded-2xl p-8 shadow-lg relative transform md:scale-[1.03] ${
            user?.plan === 'pro'
              ? 'bg-gradient-to-br from-[#1B6B5A] to-[#0d4a3d] text-white border-2 border-[#2D8A5E]'
              : 'bg-gradient-to-br from-[#1B6B5A] to-[#0d4a3d] text-white shadow-[#1B6B5A]/20'
          }`}>
            {user?.plan === 'pro' ? (
              <span className="absolute -top-3 right-6 px-3 py-1 bg-[#2D8A5E] text-white text-xs font-bold rounded-full">
                ACTIVE
              </span>
            ) : (
              <span className="absolute -top-3 right-6 px-3 py-1 bg-[#C8A84E] text-[#1A1614] text-xs font-bold rounded-full">
                RECOMMENDED
              </span>
            )}
            <h3 className="text-lg font-semibold">Pro</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">$9</span>
              <span className="text-white/60">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-white/80">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[#C8A84E] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                to="/login"
                className="mt-8 block text-center px-6 py-3 bg-white text-[#1B6B5A] rounded-xl font-semibold hover:bg-[#E8F5F0] transition-colors"
              >
                Start 7-day free trial
              </Link>
            ) : user.plan === 'pro' ? (
              <div className="mt-8 block text-center px-6 py-3 bg-white/20 text-white rounded-xl font-medium">
                Current plan
              </div>
            ) : (
              <div className="mt-8 space-y-3">
                <button
                  onClick={() => void handleUpgrade('monthly')}
                  className="w-full px-6 py-3 bg-white text-[#1B6B5A] rounded-xl font-semibold hover:bg-[#E8F5F0] transition-colors"
                >
                  {isTrialActive ? 'Subscribe to Pro — $9/mo' : 'Upgrade to Pro — $9/mo'}
                </button>
                <button
                  onClick={() => void handleUpgrade('annual')}
                  className="w-full px-6 py-3 bg-white/15 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors border border-white/20"
                >
                  Upgrade to Pro — {annualPrice}/yr
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
