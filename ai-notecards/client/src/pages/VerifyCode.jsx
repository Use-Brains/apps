import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

export default function VerifyCode() {
  const { verifyMagicLink, requestMagicLink } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);
  const submitGuard = useRef(false);

  // Redirect if no email in state
  if (!email) return <Navigate to="/login" replace />;

  const handleSubmit = async (code) => {
    if (submitGuard.current) return;
    submitGuard.current = true;
    setLoading(true);
    try {
      const data = await verifyMagicLink(email, code);
      if (!data) return;
      toast.success(data.isNewUser ? 'Account created!' : 'Welcome back!');
      if (data.isNewUser && !data.user.display_name) {
        navigate('/welcome', { replace: true });
      }
    } catch (err) {
      toast.error(err.data?.code === 'AUTH_MAGIC_CODE_EXPIRED'
        ? 'Code expired. Request a new one.'
        : err.message);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      submitGuard.current = false;
    }
  };

  const handleChange = (index, value) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (digit && index === 5 && next.every(d => d !== '')) {
      handleSubmit(next.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    if (pasted.length === 6) {
      handleSubmit(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await requestMagicLink(email);
      toast.success('New code sent!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResending(false);
    }
  };

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-brand-50/30 to-gray-50">
      <Navbar />
      <div className="flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Check your email</h1>
            <p className="text-gray-500 mb-8">
              We sent a 6-digit code to <span className="font-medium text-gray-700">{email}</span>
            </p>

            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading}
                  className="w-12 h-14 text-center text-2xl font-bold border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow disabled:opacity-50"
                />
              ))}
            </div>

            {loading && (
              <p className="text-center text-sm text-gray-500 mb-4">Verifying...</p>
            )}

            <div className="text-center space-y-3">
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-brand-600 font-medium hover:text-brand-700 disabled:opacity-50"
              >
                {resending ? 'Sending...' : "Didn't get a code? Resend"}
              </button>
              <p>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-gray-400 hover:text-gray-500"
                >
                  Use a different email
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
