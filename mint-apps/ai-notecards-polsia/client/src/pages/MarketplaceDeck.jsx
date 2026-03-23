import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { analytics } from '../lib/analytics.js';
import Navbar from '../components/Navbar.jsx';
import SharePopover from '../components/SharePopover.jsx';

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

const REPORT_REASONS = ['Inappropriate', 'Misleading', 'Spam', 'Low Quality', 'Other'];

function ReportModal({ listingId, onClose, flagType = 'listing', ratingId = null }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await api.flagListing(listingId, reason, flagType, ratingId);
      toast.success('Report submitted — thanks for helping keep the marketplace safe');
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <h2 className="text-lg font-bold text-[#1A1614] mb-1">Report this {flagType === 'review' ? 'review' : 'listing'}</h2>
        <p className="text-sm text-[#6B635A] mb-4">Select a reason for reporting.</p>
        <div className="space-y-2 mb-5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                reason === r
                  ? 'bg-[#1B6B5A] text-white'
                  : 'bg-gray-50 text-[#1A1614] hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 text-sm"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
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

export default function MarketplaceDeck() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [reportTarget, setReportTarget] = useState({ flagType: 'listing', ratingId: null });

  useEffect(() => {
    analytics.track('listing_viewed', { listing_id: id });
    Promise.all([api.getListing(id), api.getListingRatings(id)])
      .then(([listingData, ratingsData]) => {
        setData(listingData);
        setRatings(ratingsData.ratings || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please log in to purchase');
      return;
    }
    analytics.track('purchase_started', { listing_id: id });
    setPurchasing(true);
    try {
      const result = await api.createPurchase(id);
      if (result.status === 'unavailable') {
        toast(result.message);
        return;
      }
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
      {showReport && (
        <ReportModal
          listingId={id}
          flagType={reportTarget.flagType}
          ratingId={reportTarget.ratingId}
          onClose={() => setShowReport(false)}
        />
      )}
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
              <div className="flex items-center gap-3 mt-3">
                <SharePopover
                  url={`${window.location.origin}/marketplace/${listing.id}`}
                  title={listing.title}
                  cardCount={totalCards}
                  price={listing.price_cents}
                />
                {user && (
                  <button
                    onClick={() => {
                      setReportTarget({ flagType: 'listing', ratingId: null });
                      setShowReport(true);
                    }}
                    className="text-xs text-[#6B635A]/60 hover:text-red-500 transition-colors"
                  >
                    Report this listing
                  </button>
                )}
              </div>
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
                {purchasing ? 'Checking...' : `Buy for $${listing.price_cents / 100}`}
              </button>
              <p className="text-xs text-[#6B635A] mt-2">Deck purchases are not live in this handoff build yet.</p>
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

        {/* Reviews */}
        {ratings.filter((r) => r.review_text).length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-[#1A1614] mt-10 mb-4">Reviews</h2>
            <div className="space-y-4">
              {ratings
                .filter((r) => r.review_text)
                .map((review) => (
                  <div key={review.id} className="bg-white rounded-xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`w-4 h-4 ${star <= review.stars ? 'text-[#C8A84E]' : 'text-gray-200'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm font-medium text-[#1A1614]">{review.display_name}</span>
                      <span className="text-xs text-[#6B635A]">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-[#1A1614]">{review.review_text}</p>
                    {user && (
                      <button
                        onClick={() => {
                          setReportTarget({ flagType: 'review', ratingId: review.id });
                          setShowReport(true);
                        }}
                        className="mt-2 text-xs text-[#6B635A]/60 hover:text-red-500 transition-colors"
                      >
                        Report
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
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
