import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import shuffle from '../lib/shuffle.js';
import MultipleChoiceMode from '../components/study/MultipleChoiceMode.jsx';
import TypeAnswerMode from '../components/study/TypeAnswerMode.jsx';
import MatchMode from '../components/study/MatchMode.jsx';

export default function Study() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'mode-select' | 'studying' | 'results' | 'rating'
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('flip');

  // Results screen state
  const [deckStats, setDeckStats] = useState(null);
  const [hasRated, setHasRated] = useState(false);
  const [listingId, setListingId] = useState(null);
  const [isRestarting, setIsRestarting] = useState(false);

  // Rating screen state
  const [selectedStars, setSelectedStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for synchronous guards
  const completingRef = useRef(false);
  const submittingRef = useRef(false);
  const advancingRef = useRef(false);
  const advanceTimeoutRef = useRef(null);
  const resultsRef = useRef([]);

  // Fetch deck data on mount (but don't start session yet — wait for mode selection)
  useEffect(() => {
    api.getDeck(deckId)
      .then((deckData) => {
        setDeck(deckData.deck);
        setCards(deckData.cards);
        setPhase('mode-select');
      })
      .catch((err) => {
        toast.error(err.message);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [deckId]);

  // Cleanup advance timeout on unmount
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  // Stable allCards ref for MC distractors
  const allCardsRef = useRef([]);
  const stableAllCards = useMemo(() => {
    allCardsRef.current = cards;
    return cards;
  }, [cards]);

  const totalCards = mode === 'match' ? 6 : cards.length;

  // Ref-based results accumulation — avoids stale closures
  const handleRate = useCallback((rating) => {
    if (!['correct', 'missed'].includes(rating)) return;
    resultsRef.current = [...resultsRef.current, rating];
    setResults(resultsRef.current);

    if (resultsRef.current.length === totalCards && !completingRef.current) {
      completingRef.current = true;
      const correct = resultsRef.current.filter((r) => r === 'correct').length;
      api.completeSession(sessionId, correct, totalCards)
        .then((res) => {
          setDeckStats(res.deck_stats);
          setHasRated(res.has_rated);
          setListingId(res.listing_id);
          setPhase('results');
        })
        .catch(() => {
          toast.error('Failed to save results. Please try again.');
          completingRef.current = false;
        });
    }
  }, [totalCards, sessionId]);

  // Advance to next card (for flip mode and called by mode components)
  const handleAdvance = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    setFlipped(false);
  }, []);

  // Flip mode keyboard handling
  useEffect(() => {
    if (phase !== 'studying' || mode !== 'flip') return;

    const handleKey = (e) => {
      if (advancingRef.current) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      } else if (flipped && (e.key === 'ArrowRight' || e.key === '1')) {
        advancingRef.current = true;
        handleRate('correct');
        setFlipped(false);
        advanceTimeoutRef.current = setTimeout(() => {
          handleAdvance();
          advancingRef.current = false;
        }, 200);
      } else if (flipped && (e.key === 'ArrowLeft' || e.key === '2')) {
        advancingRef.current = true;
        handleRate('missed');
        setFlipped(false);
        advanceTimeoutRef.current = setTimeout(() => {
          handleAdvance();
          advancingRef.current = false;
        }, 200);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, mode, flipped, handleRate, handleAdvance]);

  const handleModeSelect = async (selectedMode) => {
    setMode(selectedMode);
    try {
      const res = await api.startSession(deckId, selectedMode);
      setSessionId(res.session.id);
      setCurrentIndex(0);
      setResults([]);
      resultsRef.current = [];
      setFlipped(false);
      completingRef.current = false;
      advancingRef.current = false;
      setCards(shuffle(cards));
      setPhase('studying');
    } catch (err) {
      toast.error(err.message || 'Failed to start session');
    }
  };

  const handleStudyAgain = async () => {
    if (isRestarting) return;
    setIsRestarting(true);
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    try {
      const res = await api.startSession(deckId, mode);
      setSessionId(res.session.id);
      setCurrentIndex(0);
      setResults([]);
      resultsRef.current = [];
      setFlipped(false);
      setCards((prev) => shuffle(prev));
      setPhase('studying');
      completingRef.current = false;
      advancingRef.current = false;
    } catch (err) {
      toast.error('Failed to start new session');
    } finally {
      setIsRestarting(false);
    }
  };

  const handleContinue = () => {
    const deckOrigin = deck?.origin;
    if (deckOrigin === 'purchased' && listingId && !hasRated) {
      setPhase('rating');
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmitRating = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await api.submitRating(listingId, selectedStars, reviewText.trim() || null);
      toast.success('Rating submitted!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Failed to submit rating');
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleFlipRate = (rating) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    handleRate(rating);
    setFlipped(false);
    advanceTimeoutRef.current = setTimeout(() => {
      handleAdvance();
      advancingRef.current = false;
    }, 200);
  };

  if (loading || phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1B6B5A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Mode Selection Screen
  if (phase === 'mode-select') {
    const modes = [
      { id: 'flip', name: 'Flip Cards', desc: 'Classic flashcard flipping', icon: '🔄', min: 1 },
      { id: 'multiple_choice', name: 'Multiple Choice', desc: 'Pick the right answer from 4 options', icon: '📝', min: 4 },
      { id: 'type_answer', name: 'Type the Answer', desc: 'Type what you remember', icon: '⌨️', min: 1 },
      { id: 'match', name: 'Match', desc: 'Match questions to answers', icon: '🔗', min: 6 },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Choose Study Mode</h1>
            <p className="text-white/60">{deck.title} · {cards.length} cards</p>
          </div>
          <div className="space-y-3">
            {modes.map((m) => {
              const disabled = cards.length < m.min;
              return (
                <button
                  key={m.id}
                  onClick={() => !disabled && handleModeSelect(m.id)}
                  disabled={disabled}
                  className={`w-full text-left p-5 rounded-2xl border transition-all ${
                    disabled
                      ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed'
                      : 'bg-white/10 border-white/10 hover:bg-white/20 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="text-white font-semibold">{m.name}</p>
                      <p className="text-white/50 text-sm">{m.desc}</p>
                      {disabled && (
                        <p className="text-[#C8A84E] text-xs mt-1">Requires {m.min}+ cards</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-center mt-6">
            <Link to="/dashboard" className="text-white/50 hover:text-white text-sm transition-colors">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Results Screen
  if (phase === 'results') {
    const correct = results.filter((r) => r === 'correct').length;
    const total = results.length;
    const currentAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const bestAccuracy = deckStats ? Math.round(Number(deckStats.best_accuracy)) : currentAccuracy;
    const timesCompleted = deckStats?.times_completed || 1;

    const isFirstCompletion = timesCompleted === 1;
    const isPersonalBest = !isFirstCompletion && currentAccuracy >= bestAccuracy;

    const continueLabel =
      deck?.origin === 'purchased' && listingId && !hasRated ? 'Rate this deck' : 'Continue';

    const missedCards = cards.filter((_, i) => results[i] === 'missed');

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#2D8A5E] to-[#1B6B5A] flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Session Complete!</h1>
          <p className="text-white/60 mb-2">{deck.title}</p>

          {isFirstCompletion && (
            <p className="text-[#C8A84E] font-semibold mb-6">First completion!</p>
          )}
          {isPersonalBest && (
            <p className="text-[#C8A84E] font-semibold mb-6">New personal best!</p>
          )}
          {!isFirstCompletion && !isPersonalBest && <div className="mb-6" />}

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-[#2D8A5E]">{correct}/{total}</p>
              <p className="text-sm text-white/50">Correct</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className={`text-3xl font-bold ${currentAccuracy >= 70 ? 'text-[#2D8A5E]' : currentAccuracy >= 40 ? 'text-[#C8A84E]' : 'text-[#C0392B]'}`}>
                {currentAccuracy}%
              </p>
              <p className="text-sm text-white/50">Accuracy</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-white">{bestAccuracy}%</p>
              <p className="text-sm text-white/50">Best</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-white">{timesCompleted}</p>
              <p className="text-sm text-white/50">Completions</p>
            </div>
          </div>

          <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-gradient-to-r from-[#2D8A5E] to-[#1B6B5A] rounded-full transition-all"
              style={{ width: `${currentAccuracy}%` }}
            />
          </div>

          {/* Missed Cards Recap */}
          {missedCards.length === 0 ? (
            <div className="bg-[#2D8A5E]/10 rounded-xl p-4 mb-8 border border-[#2D8A5E]/20">
              <p className="text-[#2D8A5E] font-semibold">Perfect score!</p>
              <p className="text-white/50 text-sm mt-1">You got every card right</p>
            </div>
          ) : (
            <div className="mb-8 text-left">
              <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                Missed Cards ({missedCards.length})
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {missedCards.map((card, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Question</p>
                    <p className="text-white text-sm mb-2">{card.front}</p>
                    <p className="text-[#2D8A5E]/60 text-xs uppercase tracking-wider mb-1">Answer</p>
                    <p className="text-[#2D8A5E] text-sm">{card.back}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleStudyAgain}
              disabled={isRestarting}
              className="flex-1 px-6 py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
            >
              {isRestarting ? 'Starting...' : 'Study again'}
            </button>
            <button
              onClick={handleContinue}
              disabled={isRestarting}
              className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              {continueLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rating Screen
  if (phase === 'rating') {
    const charCount = [...reviewText].length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 sm:p-12 max-w-md w-full text-center border border-white/10">
          <h1 className="text-2xl font-bold text-white mb-2">Rate this deck</h1>
          <p className="text-white/60 mb-1">{deck.title}</p>
          <p className="text-white/40 text-sm mb-8">{cards.length} cards</p>

          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setSelectedStars(star)}
                onMouseEnter={() => setHoveredStars(star)}
                onMouseLeave={() => setHoveredStars(0)}
                aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                className="p-1 transition-transform hover:scale-110"
              >
                <svg
                  className={`w-10 h-10 ${
                    star <= (hoveredStars || selectedStars) ? 'text-[#C8A84E]' : 'text-white/20'
                  } transition-colors`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>

          <div className="mb-6 text-left">
            <label className="text-sm text-white/60 mb-2 block">Review (optional)</label>
            <textarea
              value={reviewText}
              onChange={(e) => {
                if ([...e.target.value].length <= 200) {
                  setReviewText(e.target.value);
                }
              }}
              placeholder="Share your thoughts on this deck..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 resize-none focus:outline-none focus:border-[#1B6B5A]"
            />
            <p className={`text-xs mt-1 text-right ${charCount >= 200 ? 'text-red-400' : 'text-white/40'}`}>
              {charCount}/200
            </p>
          </div>

          <p className="text-white/40 text-xs mb-6">This rating is final and cannot be changed</p>

          <button
            onClick={handleSubmitRating}
            disabled={selectedStars === 0 || isSubmitting}
            className="w-full py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    );
  }

  // Studying phase
  const card = cards[currentIndex];
  const progress = (currentIndex / totalCards) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1614] via-[#0d4a3d] to-[#1A1614] flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <Link to="/dashboard" className="text-white/50 hover:text-white transition-colors text-sm">
          &larr; Exit
        </Link>
        <div className="text-white/60 text-sm font-medium">
          {mode === 'match' ? `${results.length}/6 pairs` : `${currentIndex + 1} / ${cards.length}`}
        </div>
        <div className="text-white/40 text-xs">
          {mode === 'flip' && 'Space to flip · Arrow keys to rate'}
          {mode === 'multiple_choice' && '1-4 to select'}
          {mode === 'type_answer' && 'Enter to submit'}
          {mode === 'match' && 'Tap to match'}
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
        {mode === 'flip' && card && (
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
                  onClick={() => handleFlipRate('missed')}
                  className="flex-1 max-w-[200px] py-4 bg-[#C0392B]/20 text-[#C0392B] rounded-2xl font-semibold hover:bg-[#C0392B]/30 transition-colors border border-[#C0392B]/20"
                >
                  Missed it
                </button>
                <button
                  onClick={() => handleFlipRate('correct')}
                  className="flex-1 max-w-[200px] py-4 bg-[#2D8A5E]/20 text-[#2D8A5E] rounded-2xl font-semibold hover:bg-[#2D8A5E]/30 transition-colors border border-[#2D8A5E]/20"
                >
                  Got it!
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'multiple_choice' && card && (
          <MultipleChoiceMode
            card={card}
            allCards={stableAllCards}
            onRate={handleRate}
            onAdvance={handleAdvance}
          />
        )}

        {mode === 'type_answer' && card && (
          <TypeAnswerMode
            card={card}
            onRate={handleRate}
            onAdvance={handleAdvance}
          />
        )}

        {mode === 'match' && (
          <MatchMode
            allCards={stableAllCards}
            onRate={handleRate}
            onAdvance={() => {
              // Match mode completes when all 6 pairs matched
              // Session completion is handled by handleRate when results.length === totalCards
            }}
          />
        )}
      </div>
    </div>
  );
}
