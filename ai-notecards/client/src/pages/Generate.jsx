import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

export default function Generate() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const data = await api.generate(input, title || undefined);
      toast.success(`Created ${data.deck.cards.length} flashcards!`);
      navigate(`/decks/${data.deck.id}`);
    } catch (err) {
      if (err.data?.limit) {
        toast.error(err.message);
      } else {
        toast.error(err.message || 'Generation failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Flashcards</h1>
        <p className="text-gray-500 mb-8">
          Paste your notes or type a topic — AI will create study cards for you.
        </p>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Deck title <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="e.g., Biology Chapter 5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes or topic
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
              rows={10}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-y leading-relaxed"
              placeholder="Paste your lecture notes here, or type a topic like 'Photosynthesis' or 'World War II causes'..."
            />
            <p className="text-xs text-gray-400 mt-1.5">{input.length} characters</p>
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating cards...
              </>
            ) : (
              'Generate Flashcards'
            )}
          </button>
        </form>

        {loading && (
          <div className="mt-8 bg-brand-50 border border-brand-100 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-brand-100 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-brand-700 font-medium">AI is reading your content and creating flashcards...</p>
            <p className="text-brand-500 text-sm mt-1">This usually takes 5-10 seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}
