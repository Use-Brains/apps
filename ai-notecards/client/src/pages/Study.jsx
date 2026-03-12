import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';

export default function Study() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]); // 'correct' | 'missed'
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | studying | summary
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDeck(deckId), api.startSession(deckId)])
      .then(([deckData, sessionData]) => {
        setDeck(deckData.deck);
        // Shuffle cards for study variety
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
        // Session complete
        const correct = newResults.filter((r) => r === 'correct').length;
        try {
          await api.completeSession(sessionId, correct, cards.length);
        } catch {
          // Non-critical
        }
        setPhase('summary');
      } else {
        // Brief delay before showing next card
        setTimeout(() => setCurrentIndex((i) => i + 1), 200);
      }
    },
    [currentIndex, cards.length, results, sessionId]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== 'studying') return;

    const handleKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) {
          setFlipped(true);
        }
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
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Summary screen
  if (phase === 'summary') {
    const correct = results.filter((r) => r === 'correct').length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center border border-white/10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Session Complete!</h1>
          <p className="text-brand-300 mb-8">{deck.title}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-white">{total}</p>
              <p className="text-sm text-brand-300">Cards</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-3xl font-bold text-green-400">{correct}</p>
              <p className="text-sm text-brand-300">Correct</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className={`text-3xl font-bold ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {pct}%
              </p>
              <p className="text-sm text-brand-300">Accuracy</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
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
              className="flex-1 px-6 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-400 transition-colors"
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

  // Study mode
  const card = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4">
        <Link to="/dashboard" className="text-brand-300 hover:text-white transition-colors text-sm">
          &larr; Exit
        </Link>
        <div className="text-brand-300 text-sm font-medium">
          {currentIndex + 1} / {cards.length}
        </div>
        <div className="text-brand-400 text-xs">
          Space to flip &middot; Arrow keys to rate
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 sm:px-8">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-300 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div
            className="perspective cursor-pointer"
            style={{ minHeight: '320px' }}
            onClick={() => !flipped && setFlipped(true)}
          >
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`} style={{ minHeight: '320px' }}>
              {/* Front */}
              <div className="flip-card-front bg-white rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center shadow-2xl shadow-black/20 border border-white/20">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-6">Question</p>
                <p className="text-xl sm:text-2xl text-gray-900 font-medium text-center leading-relaxed">
                  {card.front}
                </p>
                <p className="text-sm text-gray-400 mt-8">Tap to reveal answer</p>
              </div>

              {/* Back */}
              <div className="flip-card-back bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center shadow-2xl shadow-black/20 border border-brand-400/20">
                <p className="text-xs uppercase tracking-wider text-brand-200 font-medium mb-6">Answer</p>
                <p className="text-xl sm:text-2xl text-white font-medium text-center leading-relaxed">
                  {card.back}
                </p>
              </div>
            </div>
          </div>

          {/* Rating buttons */}
          {flipped && (
            <div className="flex gap-4 mt-8 justify-center">
              <button
                onClick={() => handleRate('missed')}
                className="flex-1 max-w-[200px] py-4 bg-red-500/20 text-red-300 rounded-2xl font-semibold hover:bg-red-500/30 transition-colors border border-red-500/20"
              >
                Missed it
              </button>
              <button
                onClick={() => handleRate('correct')}
                className="flex-1 max-w-[200px] py-4 bg-green-500/20 text-green-300 rounded-2xl font-semibold hover:bg-green-500/30 transition-colors border border-green-500/20"
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
