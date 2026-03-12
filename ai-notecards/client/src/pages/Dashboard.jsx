import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [decks, setDecks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success('Welcome to Pro! Enjoy unlimited access.');
      refreshUser();
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

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
      toast.success('Deck deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        {stats && stats.total_sessions > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Sessions', value: stats.total_sessions },
              { label: 'Cards studied', value: stats.total_cards_studied },
              { label: 'Correct', value: stats.total_correct },
              { label: 'Accuracy', value: `${stats.accuracy}%` },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Decks</h1>
            <p className="text-gray-500 text-sm mt-1">
              {decks.length} deck{decks.length !== 1 ? 's' : ''}
              {user?.plan === 'free' && ` of 10`}
            </p>
          </div>
          <Link
            to="/generate"
            className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center gap-2"
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
            <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No decks yet</h2>
            <p className="text-gray-500 mb-6">Generate your first AI flashcard deck to get started</p>
            <Link
              to="/generate"
              className="inline-flex px-6 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
            >
              Generate your first deck
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <div
                key={deck.id}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-brand-200 hover:shadow-md transition-all group"
              >
                <Link to={`/decks/${deck.id}`} className="block">
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors line-clamp-2">
                    {deck.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {deck.card_count} card{deck.card_count !== 1 ? 's' : ''} &middot;{' '}
                    {new Date(deck.created_at).toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                  <Link
                    to={`/study/${deck.id}`}
                    className="flex-1 text-center px-3 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-medium hover:bg-brand-100 transition-colors"
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
                    onClick={() => handleDelete(deck.id, deck.title)}
                    className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
