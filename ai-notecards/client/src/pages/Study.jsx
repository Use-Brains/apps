import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';

function RatingModal({ listingId, onClose }) {
  const [selectedStars, setSelectedStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedStars === 0) return;
    setSubmitting(true);
    try {
      await api.submitRating(listingId, selectedStars);
      toast.success('Thanks for rating!');
      onClose();
    } catch (err) {
      toast.error(err.message);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <h2 className="text-xl font-bold text-[#1A1614] mb-2">Rate this deck</h2>
        <p className="text-[#6B635A] text-sm mb-6">How was your study experience?</p>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setSelectedStars(star)}
              onMouseEnter={() => setHoveredStars(star)}
              onMouseLeave={() => setHoveredStars(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <svg
                className={`w-10 h-10 ${
                  star <= (hoveredStars || selectedStars) ? 'text-[#C8A84E]' : 'text-gray-200'
                } transition-colors`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={selectedStars === 0 || submitting}
            className="flex-1 py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 text-[#6B635A] text-sm hover:text-[#1A1614] transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Study() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [listingId, setListingId] = useState(null);

  useEffect(() => {
    Promise.all([api.getDeck(deckId), api.startSession(deckId)])
      .then(([deckData, sessionData]) => {
        setDeck(deckData.deck);
        const shuffled = [...deckData.cards].sort(() => Math.random() - 0.5);
        setCards(shuffled);
        setSessionId(sessionData.session.id);
        setPhase('studying');
      })
      .catch((err) => {
        toast.error(err.message);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [deckId]);

  const handleRate = useCallback(
    async (rating) => {
      const newResults = [...results, rating];
      setResults(newResults);
      setFlipped(false);

      if (currentIndex + 1 >= cards.length) {
        const correct = newResults.filter((r) => r === 'correct').length;
        try {
          const response = await api.completeSession(sessionId, correct, cards.length);
          // Check if this is a purchased deck that can be rated
          if (response.deck_origin === 'purchased' && response.listing_id) {
            setListingId(response.listing_id);
            setShowRating(true);
          }
        } catch {}
        setPhase('summary');
      } else {
        setTimeout(() => setCurrentIndex((i) => i + 1), 200);
      }
    },
    [currentIndex, cards.length, results, sessionId]
  );

  useEffect(() => {
    if (phase !== 'studying') return;

    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      } else if (flipped && (e.key === 'ArrowRight' || e.key === '1')) {
        handleRate('correct');
      } else if (flipped && (e.key === 'ArrowLeft' || e.key === '2')) {
        handleRate('missed');
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, flipped, handleRate]);

  if (loading || phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1B6B5A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === 'summary') {
    const correct = results.filter((r) => r === 'correct').length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex items-center justify-center p-4">
        {showRating && listingId && (
          <RatingModal listingId={listingId} onClose={() => setShowRating(false)} />
        )}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#2D8A5E] to-[#1B6B5A] flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Session Complete!</h1>
          <p className="text-white/60 mb-8">{deck.title}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-white">{total}</p>
              <p className="text-sm text-white/50">Cards</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-[#2D8A5E]">{correct}</p>
              <p className="text-sm text-white/50">Correct</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className={`text-3xl font-bold ${pct >= 70 ? 'text-[#2D8A5E]' : pct >= 40 ? 'text-[#C8A84E]' : 'text-[#C0392B]'}`}>
                {pct}%
              </p>
              <p className="text-sm text-white/50">Accuracy</p>
            </div>
          </div>

          <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-gradient-to-r from-[#2D8A5E] to-[#1B6B5A] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setFlipped(false);
                setResults([]);
                setPhase('studying');
                setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
                api.startSession(deckId).then((d) => setSessionId(d.session.id));
              }}
              className="flex-1 px-6 py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors"
            >
              Study again
            </button>
            <Link
              to="/dashboard"
              className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors text-center"
            >
              Back to decks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const card = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <Link to="/dashboard" className="text-white/50 hover:text-white transition-colors text-sm">
          &larr; Exit
        </Link>
        <div className="text-white/60 text-sm font-medium">
          {currentIndex + 1} / {cards.length}
        </div>
        <div className="text-white/40 text-xs">
          Space to flip · Arrow keys to rate
        </div>
      </div>

      <div className="px-4 sm:px-8">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1B6B5A] to-[#2D8A5E] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div
            className="perspective cursor-pointer"
            style={{ minHeight: '320px' }}
            onClick={() => !flipped && setFlipped(true)}
          >
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`} style={{ minHeight: '320px' }}>
              <div className="flip-card-front bg-white rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center shadow-2xl shadow-black/20 border border-white/20">
                <p className="text-xs uppercase tracking-wider text-[#6B635A] font-medium mb-6">Question</p>
                <p className="text-xl sm:text-2xl text-[#1A1614] font-medium text-center leading-relaxed">
                  {card.front}
                </p>
                <p className="text-sm text-[#6B635A] mt-8">Tap to reveal answer</p>
              </div>
              <div className="flip-card-back bg-gradient-to-br from-[#1B6B5A] to-[#0d4a3d] rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center shadow-2xl shadow-black/20">
                <p className="text-xs uppercase tracking-wider text-white/50 font-medium mb-6">Answer</p>
                <p className="text-xl sm:text-2xl text-white font-medium text-center leading-relaxed">
                  {card.back}
                </p>
              </div>
            </div>
          </div>

          {flipped && (
            <div className="flex gap-4 mt-8 justify-center">
              <button
                onClick={() => handleRate('missed')}
                className="flex-1 max-w-[200px] py-4 bg-[#C0392B]/20 text-[#C0392B] rounded-2xl font-semibold hover:bg-[#C0392B]/30 transition-colors border border-[#C0392B]/20"
              >
                Missed it
              </button>
              <button
                onClick={() => handleRate('correct')}
                className="flex-1 max-w-[200px] py-4 bg-[#2D8A5E]/20 text-[#2D8A5E] rounded-2xl font-semibold hover:bg-[#2D8A5E]/30 transition-colors border border-[#2D8A5E]/20"
              >
                Got it!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
