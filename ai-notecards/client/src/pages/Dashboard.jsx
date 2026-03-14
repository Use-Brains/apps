import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
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

function getDeckSellState(deck, user) {
  const isSeller = user.connect_charges_enabled && user.seller_terms_accepted_at;

  if (deck.listing_id && deck.listing_status === 'active') return 'view';
  if (deck.listing_id && deck.listing_status === 'delisted') return 'relist';
  if (!isSeller) return 'hidden';
  if (deck.origin === 'purchased') return 'hidden';
  if (deck.card_count < 10) return 'disabled';
  return 'sell';
}

function SellIcon({ state, deck, onRelist }) {
  const navigate = useNavigate();

  if (state === 'hidden') return null;

  if (state === 'disabled') {
    return (
      <div className="absolute top-3 right-3 opacity-40 cursor-not-allowed">
        <svg className="w-5 h-5 text-[#6B635A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      </div>
    );
  }

  const config = {
    sell: { label: 'Sell', onClick: () => navigate(`/sell/${deck.id}`) },
    view: { label: 'View', onClick: () => navigate(`/marketplace/${deck.listing_id}`) },
    relist: { label: 'Relist', onClick: onRelist },
  };

  const { label, onClick } = config[state];

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-[#E8F5F0] text-[#1B6B5A] rounded-lg text-xs font-medium hover:bg-[#d0ebe3] transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
      {label}
    </button>
  );
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [showSellerPrompt, setShowSellerPrompt] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success('Welcome to Pro! Enjoy full access.');
      refreshUser().then(() => {
        setShowSellerPrompt(true);
      });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  useEffect(() => {
    Promise.all([api.getDecks(), api.getStats()])
      .then(([deckData, statsData]) => {
        setDecks(deckData.decks);
        setStats(statsData.stats);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshDecks = async () => {
    try {
      const deckData = await api.getDecks();
      setDecks(deckData.decks);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id, title, deck) => {
    const message = deck.listing_id
      ? `Delete "${title}"? This deck has a marketplace listing. Deleting it will also remove the listing and sales history. This cannot be undone.`
      : `Delete "${title}"? This cannot be undone.`;
    if (!confirm(message)) return;
    try {
      await api.deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
      toast.success('Deck deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRelist = async (listingId) => {
    try {
      await api.relistListing(listingId);
      toast.success('Listing relisted');
      await refreshDecks();
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

  const isTrialActive = user?.plan === 'trial' && user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();
  const trialDaysLeft = isTrialActive
    ? Math.max(0, Math.ceil((new Date(user.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;
  const generatedDeckCount = decks.filter((d) => d.origin !== 'purchased').length;
  const isSeller = user?.connect_charges_enabled && user?.seller_terms_accepted_at;
  const showSellerBanner = showSellerPrompt && user?.plan === 'pro' && !isSeller;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      {showTermsModal && (
        <SellerTermsModal
          onAccept={handleSellerOnboard}
          onClose={() => setShowTermsModal(false)}
        />
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Post-checkout seller prompt */}
        {showSellerBanner && (
          <div className="bg-gradient-to-r from-[#E8F5F0] to-[#d0ebe3] border border-[#1B6B5A]/20 rounded-xl p-5 mb-6">
            <h2 className="text-lg font-semibold text-[#1A1614] mb-1">Welcome to Pro!</h2>
            <p className="text-sm text-[#6B635A] mb-4">
              Want to sell your flashcard decks on the marketplace?
              You can skip this and become a seller later in Settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTermsModal(true)}
                className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors text-sm"
              >
                Become a Seller
              </button>
              <button
                onClick={() => setShowSellerPrompt(false)}
                className="px-4 py-2.5 text-[#6B635A] text-sm hover:text-[#1A1614] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Trial banner */}
        {isTrialActive && (
          <div className="bg-[#E8F5F0] border border-[#1B6B5A]/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-[#1B6B5A] text-sm">
              <span className="font-semibold">Pro trial active</span> — {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining.
              You have 10 generations/day and unlimited decks.
            </p>
            <Link to="/pricing" className="text-[#1B6B5A] text-sm font-semibold hover:underline shrink-0 ml-4">
              Subscribe now
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Study Score', value: user?.study_score ?? 0 },
            { label: 'Sessions', value: stats?.total_sessions ?? 0 },
            { label: 'Cards studied', value: stats?.total_cards_studied ?? 0 },
            { label: 'Accuracy', value: `${stats?.accuracy ?? 0}%` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-sm text-[#6B635A]">{s.label}</p>
              <p className="text-2xl font-bold text-[#1A1614] mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1614]">Your Decks</h1>
            <p className="text-[#6B635A] text-sm mt-1">
              {decks.length} deck{decks.length !== 1 ? 's' : ''}
              {user?.plan === 'free' && ` (${generatedDeckCount}/10 generated)`}
            </p>
          </div>
          <Link
            to="/generate"
            className="px-5 py-2.5 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Generate Cards
          </Link>
        </div>

        {/* Deck Grid */}
        {decks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#E8F5F0] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#1B6B5A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[#1A1614] mb-2">No decks yet</h2>
            <p className="text-[#6B635A] mb-6">Generate your first AI flashcard deck to get started</p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/generate"
                className="inline-flex px-6 py-3 bg-[#1B6B5A] text-white rounded-xl font-medium hover:bg-[#155a4a] transition-colors"
              >
                Generate your first deck
              </Link>
              <Link
                to="/marketplace"
                className="inline-flex px-6 py-3 bg-white text-[#1A1614] border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Browse marketplace
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => {
              const sellState = getDeckSellState(deck, user);
              return (
                <div
                  key={deck.id}
                  className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#1B6B5A]/30 hover:shadow-md transition-all group relative"
                >
                  <SellIcon
                    state={sellState}
                    deck={deck}
                    onRelist={() => handleRelist(deck.listing_id)}
                  />
                  <Link to={`/decks/${deck.id}`} className="block">
                    <div className="flex items-center gap-2 mb-1 pr-16">
                      <h3 className="font-semibold text-[#1A1614] group-hover:text-[#1B6B5A] transition-colors line-clamp-2">
                        {deck.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm text-[#6B635A]">
                        {deck.card_count} card{deck.card_count !== 1 ? 's' : ''}
                      </p>
                      {deck.origin === 'purchased' && (
                        <span className="px-1.5 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-medium rounded">
                          Purchased
                        </span>
                      )}
                      {deck.has_rated && (
                        <span className="px-1.5 py-0.5 bg-[#C8A84E]/10 text-[#C8A84E] text-xs font-medium rounded">
                          Rated
                        </span>
                      )}
                      <span className="text-sm text-[#6B635A]">
                        · {new Date(deck.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                    <Link
                      to={`/study/${deck.id}`}
                      className="flex-1 text-center px-3 py-2 bg-[#E8F5F0] text-[#1B6B5A] rounded-lg text-sm font-medium hover:bg-[#d0ebe3] transition-colors"
                    >
                      Study
                    </Link>
                    <Link
                      to={`/decks/${deck.id}`}
                      className="flex-1 text-center px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(deck.id, deck.title, deck)}
                      className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
