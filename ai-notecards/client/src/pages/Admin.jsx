import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

function FlagRow({ flag, onResolve }) {
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleResolve = async (status, suspendSeller = false) => {
    setResolving(true);
    try {
      await onResolve(flag.id, { status, admin_notes: notes || undefined, suspend_seller: suspendSeller });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              flag.status === 'pending' ? 'bg-[#C8A84E]/10 text-[#C8A84E]' :
              flag.status === 'upheld' ? 'bg-red-50 text-red-600' :
              'bg-gray-100 text-[#6B635A]'
            }`}>
              {flag.status}
            </span>
            <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full">
              {flag.reason}
            </span>
          </div>
          <h3 className="font-semibold text-[#1A1614] truncate">{flag.listing_title}</h3>
          <p className="text-sm text-[#6B635A] mt-1">
            Reported by {flag.reporter_name || flag.reporter_email} · Seller: {flag.seller_name || flag.seller_email}
          </p>
          <p className="text-xs text-[#6B635A]/60 mt-1">
            {new Date(flag.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        {flag.status === 'pending' && (
          <button onClick={() => setExpanded(!expanded)} className="text-sm text-[#1B6B5A] font-medium shrink-0">
            {expanded ? 'Collapse' : 'Review'}
          </button>
        )}
      </div>

      {expanded && flag.status === 'pending' && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Admin notes (optional)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/20 focus:border-[#1B6B5A]"
            rows={2}
          />
          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              onClick={() => handleResolve('dismissed')}
              disabled={resolving}
              className="px-4 py-2 text-sm font-medium text-[#6B635A] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              onClick={() => handleResolve('upheld')}
              disabled={resolving}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              Uphold (Delist)
            </button>
            <button
              onClick={() => handleResolve('upheld', true)}
              disabled={resolving}
              className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50"
            >
              Uphold + Suspend Seller
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    api.getFlags()
      .then((data) => setFlags(data.flags))
      .catch((err) => {
        toast.error(err.message);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleResolve = async (flagId, data) => {
    try {
      await api.resolveFlag(flagId, data);
      setFlags((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, status: data.status, admin_notes: data.admin_notes, resolved_at: new Date().toISOString() } : f))
      );
      toast.success(`Flag ${data.status}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = flags.filter((f) => filter === 'all' || f.status === filter);
  const pendingCount = flags.filter((f) => f.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1614]">Content Moderation</h1>
            <p className="text-sm text-[#6B635A] mt-1">
              {pendingCount} pending {pendingCount === 1 ? 'report' : 'reports'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {['pending', 'upheld', 'dismissed', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === f
                  ? 'bg-[#1B6B5A] text-white'
                  : 'bg-white text-[#6B635A] hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#E8F5F0] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#1B6B5A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#6B635A] font-medium">No {filter === 'all' ? '' : filter} reports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((flag) => (
              <FlagRow key={flag.id} flag={flag} onResolve={handleResolve} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
