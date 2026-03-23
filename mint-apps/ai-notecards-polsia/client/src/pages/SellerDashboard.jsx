import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { getSellerToolsMode } from '../lib/runtime.js';
import Navbar from '../components/Navbar.jsx';
import SharePopover from '../components/SharePopover.jsx';

export default function SellerDashboard() {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const sellerToolsMode = getSellerToolsMode(user);
  const [searchParams] = useSearchParams();
  const [dashboard, setDashboard] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!sellerToolsMode.enabled) return;
    const connectStatus = searchParams.get('connect');
    if (connectStatus === 'return') {
      window.history.replaceState({}, '', '/seller');
      api.refreshOnboarding()
        .then(() => refreshUser())
        .catch(() => {});
    } else if (connectStatus === 'refresh') {
      window.history.replaceState({}, '', '/seller');
      toast.error('Your Stripe link expired. Click below to try again.');
    }
  }, [authLoading, refreshUser, searchParams, sellerToolsMode.enabled]);

  useEffect(() => {
    if (!sellerToolsMode.enabled) {
      setLoading(false);
      return;
    }

    if (!user?.connect_charges_enabled) {
      setLoading(false);
      return;
    }

    Promise.all([api.getSellerDashboard(), api.getSellerListings()])
      .then(([dashData, listData]) => {
        setDashboard(dashData);
        setListings(listData.listings);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [sellerToolsMode.enabled, user?.connect_charges_enabled]);

  const handleOnboard = async () => {
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

  // Poll for moderation status changes when pending listings exist
  const hasPending = useMemo(
    () => listings.some(l => l.status === 'pending_review' && l.moderation_status === 'pending'),
    [listings]
  );

  useEffect(() => {
    if (!hasPending) return;
    let delay = 3000;
    let canceled = false;
    let timeoutId;
    const poll = async () => {
      if (canceled) return;
      try {
        const data = await api.getSellerListings();
        if (canceled) return;
        setListings(data.listings);
        if (data.listings.some(l => l.status === 'pending_review' && l.moderation_status === 'pending') && !canceled) {
          delay = Math.min(delay * 1.5, 30000);
          timeoutId = setTimeout(poll, delay);
        }
      } catch { /* swallow — stale data is better than error toasts every 3s */ }
    };
    timeoutId = setTimeout(poll, delay);
    return () => { canceled = true; clearTimeout(timeoutId); };
  }, [hasPending]);

  const handleDelist = async id => {
    if (!confirm('Delist this deck? Buyers can no longer find it in the marketplace.')) return;
    try {
      await api.delistListing(id);
      setListings(prev => prev.map(l => (l.id === id ? { ...l, status: 'delisted' } : l)));
      toast.success('Listing delisted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!sellerToolsMode.enabled) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            <h1 className="text-2xl font-bold text-[#1A1614] mb-3">Seller Dashboard</h1>
            <p className="text-[#6B635A] mb-4">
              Seller pages stay visible here, but seller setup, listing management, and payout actions are read-only in this deployment.
            </p>
            <p className="text-sm text-[#6B635A] mb-6">{sellerToolsMode.message}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/dashboard" className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors">
                Back to Decks
              </Link>
              <Link to="/marketplace" className="px-5 py-2.5 border border-[#1B6B5A]/30 text-[#1B6B5A] rounded-xl font-medium hover:bg-[#E8F5F0] transition-colors">
                Browse Marketplace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not connected — show onboarding CTA
  if (!user?.connect_charges_enabled) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-16 h-16 bg-[#E8F5F0] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#1B6B5A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1614] mb-3">Start selling your decks</h1>
          <p className="text-[#6B635A] mb-8 max-w-md mx-auto">Connect your Stripe account to start earning money from your flashcard decks. You'll earn 50% of every sale.</p>
          {user?.plan === 'pro' ? (
            <button onClick={handleOnboard} disabled={onboarding} className="px-8 py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50">
              {onboarding ? 'Redirecting to Stripe...' : 'Connect with Stripe'}
            </button>
          ) : (
            <div>
              <p className="text-sm text-[#6B635A] mb-4">Pro subscription required to sell.</p>
              <Link to="/pricing" className="px-6 py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors inline-block">
                Upgrade to Pro
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-6 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const earnings = dashboard?.earnings || {};
  const listingStats = dashboard?.listings || {};

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-[#1A1614] mb-6">Seller Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Earnings', value: `$${(earnings.total_earnings_cents / 100).toFixed(2)}`, sub: `$${(earnings.total_gross_cents / 100).toFixed(2)} gross` },
            { label: 'Last 30 Days', value: `$${(earnings.last_30_earnings_cents / 100).toFixed(2)}` },
            { label: 'Total Sales', value: earnings.total_sales },
            { label: 'Active Listings', value: `${listingStats.active_listings} / ${listingStats.total_listings}` }
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-sm text-[#6B635A]">{s.label}</p>
              <p className="text-2xl font-bold font-mono text-[#1A1614] mt-1">{s.value}</p>
              {s.sub && <p className="text-xs text-[#6B635A] mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Listings table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#1A1614]">Your Listings</h2>
          </div>
          {listings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#6B635A] mb-4">No listings yet. List your first deck!</p>
              <Link to="/dashboard" className="text-[#1B6B5A] font-medium hover:underline">
                Go to your decks
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {listings.map(listing => (
                <div key={listing.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link to={`/marketplace/${listing.id}`} className="font-medium text-[#1A1614] hover:text-[#1B6B5A] truncate block">
                      {listing.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#6B635A]">
                      <span>{listing.category_name}</span>
                      <span>·</span>
                      <span className="font-mono">${listing.price_cents / 100}</span>
                      <span>·</span>
                      <span>{listing.purchase_count} sales</span>
                      <span>·</span>
                      <span>{listing.card_count} cards</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {listing.status === 'pending_review' && listing.moderation_status === 'pending' ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-700">
                        Under Review
                      </span>
                    ) : listing.status === 'pending_review' && listing.moderation_status === 'rejected' ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-50 text-red-600" title={listing.moderation_reason || ''}>
                        Rejected
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          listing.status === 'active' ? 'bg-[#E8F5F0] text-[#1B6B5A]' : listing.status === 'delisted' ? 'bg-gray-100 text-[#6B635A]' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {listing.status}
                      </span>
                    )}
                    {listing.status === 'active' && (
                      <>
                        <SharePopover
                          url={`${window.location.origin}/marketplace/${listing.id}`}
                          title={listing.title}
                          cardCount={listing.card_count}
                          price={listing.price_cents}
                        />
                        <button onClick={() => handleDelist(listing.id)} className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                          Delist
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
