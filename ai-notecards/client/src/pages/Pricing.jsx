import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

export default function Pricing() {
  const { user } = useAuth();

  const handleUpgrade = async () => {
    try {
      const data = await api.createCheckout();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50/30 to-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-4">Choose your plan</h1>
        <p className="text-center text-gray-600 mb-12 max-w-lg mx-auto">
          Start free. Upgrade when you need unlimited access.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free */}
          <div className={`bg-white rounded-2xl p-8 border shadow-sm ${user?.plan === 'free' ? 'border-brand-300 ring-2 ring-brand-100' : 'border-gray-200'}`}>
            {user?.plan === 'free' && (
              <span className="inline-block px-3 py-1 bg-brand-100 text-brand-700 text-xs font-semibold rounded-full mb-4">
                Current plan
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">Free</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">$0</span>
              <span className="text-gray-500">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-gray-600">
              {['3 AI generations per day', 'Up to 10 decks', 'Full study mode', 'Progress tracking'].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                to="/signup"
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
          <div className={`rounded-2xl p-8 shadow-lg relative ${
            user?.plan === 'pro'
              ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white border border-brand-400 ring-2 ring-brand-300'
              : 'bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand-500/20'
          }`}>
            {user?.plan === 'pro' ? (
              <span className="absolute -top-3 right-6 px-3 py-1 bg-green-400 text-green-900 text-xs font-bold rounded-full">
                ACTIVE
              </span>
            ) : (
              <span className="absolute -top-3 right-6 px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                POPULAR
              </span>
            )}
            <h3 className="text-lg font-semibold">Pro</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">$5</span>
              <span className="text-brand-200">/month</span>
            </div>
            <ul className="mt-6 space-y-3 text-brand-100">
              {['Unlimited AI generations', 'Unlimited decks', 'Priority generation speed', 'Everything in Free'].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!user ? (
              <Link
                to="/signup"
                className="mt-8 block text-center px-6 py-3 bg-white text-brand-700 rounded-xl font-semibold hover:bg-brand-50 transition-colors"
              >
                Start free trial
              </Link>
            ) : user.plan === 'pro' ? (
              <div className="mt-8 block text-center px-6 py-3 bg-white/20 text-white rounded-xl font-medium">
                Current plan
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                className="mt-8 w-full px-6 py-3 bg-white text-brand-700 rounded-xl font-semibold hover:bg-brand-50 transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
