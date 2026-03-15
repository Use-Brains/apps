import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

export default function Login() {
  const { loginWithGoogle, requestMagicLink } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await loginWithGoogle(credentialResponse.credential);
      if (!data) return;
      toast.success(data.isNewUser ? 'Account created!' : 'Welcome back!');
      if (data.isNewUser && !data.user.display_name) {
        navigate('/welcome', { replace: true });
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await requestMagicLink(email.trim());
      navigate('/verify-code', { state: { email: email.trim() } });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50/30 to-gray-50">
      <Navbar />
      <div className="flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome</h1>
            <p className="text-gray-500 mb-8">Sign in or create an account</p>

            {/* Google Sign-In */}
            <div className="flex justify-center mb-6">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google sign-in failed')}
                text="continue_with"
                shape="pill"
                width="360"
              />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Magic Link */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending code...' : 'Continue with email'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-400">
              We'll send you a 6-digit code to sign in. No password needed.
            </p>
            <p className="mt-3 text-center text-xs text-gray-400">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-[#1B6B5A] hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-[#1B6B5A] hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
