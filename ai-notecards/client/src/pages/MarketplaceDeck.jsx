import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

function FlipCard({ card }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className="perspective cursor-pointer"
      style={{ minHeight: '200px' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`} style={{ minHeight: '200px' }}>
        <div className="flip-card-front bg-white rounded-xl p-6 flex flex-col items-center justify-center border border-gray-200 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-[#6B635A] font-medium mb-3">Front</p>
          <p className="text-sm text-[#1A1614] text-center leading-relaxed">{card.front}</p>
          <p className="text-xs text-[#6B635A] mt-4">Tap to flip</p>
        </div>
        <div className="flip-card-back bg-[#1B6B5A] rounded-xl p-6 flex flex-col items-center justify-center text-white">
          <p className="text-xs uppercase tracking-wider text-white/60 font-medium mb-3">Back</p>
          <p className="text-sm text-center leading-relaxed">{card.back}</p>
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceDeck() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    api.getListing(id)
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please log in to purchase');
      return;
    }
    setPurchasing(true);
    try {
      const result = await api.createPurchase(id);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-gray-100 rounded w-full mb-2" />
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-8" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-[#1A1614] mb-4">Listing not found</h1>
          <Link to="/marketplace" className="text-[#1B6B5A] font-medium hover:underline">
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { listing, totalCards, sampleCards, previewCount } = data;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#6B635A] mb-6">
          <Link to="/marketplace" className="hover:text-[#1B6B5A]">Marketplace</Link>
          <span>/</span>
          <span className="text-[#1B6B5A]">{listing.category_name}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#1A1614] mb-2">{listing.title}</h1>
              <p className="text-[#6B635A] mb-4">{listing.description}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2 py-1 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-medium rounded">
                  {listing.category_name}
                </span>
                <span className="text-sm text-[#6B635A]">{totalCards} cards</span>
                <span className="text-sm text-[#6B635A]">{listing.purchase_count} purchases</span>
                {listing.rating_count >= 3 ? (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-[#C8A84E]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-medium">{Number(listing.average_rating).toFixed(1)}</span>
                    <span className="text-xs text-[#6B635A]">({listing.rating_count} ratings)</span>
                  </div>
                ) : (
                  <span className="px-1.5 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-medium rounded">New</span>
                )}
              </div>
              {listing.tags?.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {listing.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-[#6B635A] text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {listing.seller_name && (
                <p className="text-sm text-[#6B635A] mt-3">
                  By <span className="font-medium text-[#1A1614]">{listing.seller_name}</span>
                  {listing.seller_study_score > 0 && (
                    <span className="ml-1">· Study Score: {listing.seller_study_score}</span>
                  )}
                </p>
              )}
            </div>
            <div className="sm:text-right shrink-0">
              <p className="font-mono text-3xl font-bold text-[#1A1614] mb-3">
                ${listing.price_cents / 100}
              </p>
              <button
                onClick={handlePurchase}
                disabled={purchasing || listing.status !== 'active'}
                className="w-full sm:w-auto px-8 py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
              >
                {purchasing ? 'Processing...' : `Buy for $${listing.price_cents / 100}`}
              </button>
              <p className="text-xs text-[#6B635A] mt-2">Non-refundable digital purchase</p>
            </div>
          </div>
        </div>

        {/* Sample cards */}
        <h2 className="text-lg font-semibold text-[#1A1614] mb-4">
          Preview ({previewCount} of {totalCards} cards)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sampleCards.map((card, i) => (
            <FlipCard key={i} card={card} />
          ))}
        </div>
      </div>

      {/* Mobile sticky buy bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xl font-bold text-[#1A1614]">${listing.price_cents / 100}</p>
            <p className="text-xs text-[#6B635A]">{totalCards} cards</p>
          </div>
          <button
            onClick={handlePurchase}
            disabled={purchasing || listing.status !== 'active'}
            className="flex-1 max-w-[200px] py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
          >
            {purchasing ? 'Processing...' : `Buy for $${listing.price_cents / 100}`}
          </button>
        </div>
      </div>
    </div>
  );
}
