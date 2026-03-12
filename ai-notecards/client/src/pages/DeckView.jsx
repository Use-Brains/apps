import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import Navbar from '../components/Navbar.jsx';

export default function DeckView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // card id being edited
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [addingCard, setAddingCard] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  useEffect(() => {
    api.getDeck(id)
      .then((data) => {
        setDeck(data.deck);
        setCards(data.cards);
        setTitleValue(data.deck.title);
      })
      .catch((err) => {
        toast.error(err.message);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveTitle = async () => {
    if (!titleValue.trim() || titleValue === deck.title) {
      setEditingTitle(false);
      return;
    }
    try {
      const data = await api.updateDeck(id, titleValue);
      setDeck(data.deck);
      setEditingTitle(false);
      toast.success('Title updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEdit = (card) => {
    setEditing(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const handleSaveCard = async (cardId) => {
    try {
      const data = await api.updateCard(id, cardId, editFront, editBack);
      setCards((prev) => prev.map((c) => (c.id === cardId ? data.card : c)));
      setEditing(null);
      toast.success('Card updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteCard = async (cardId) => {
    try {
      await api.deleteCard(id, cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast.success('Card deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;
    try {
      const data = await api.addCard(id, newFront, newBack);
      setCards((prev) => [...prev, data.card]);
      setNewFront('');
      setNewBack('');
      setAddingCard(false);
      toast.success('Card added');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-1/4" />
            <div className="space-y-3 mt-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white rounded-xl border border-gray-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                  className="text-2xl font-bold px-2 py-1 border border-brand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button onClick={handleSaveTitle} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm">
                  Save
                </button>
                <button onClick={() => { setEditingTitle(false); setTitleValue(deck.title); }} className="px-3 py-1.5 text-gray-500 text-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-brand-700 transition-colors"
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
              >
                {deck.title}
              </h1>
            )}
            <p className="text-gray-500 text-sm mt-1">
              {cards.length} card{cards.length !== 1 ? 's' : ''} &middot; Created{' '}
              {new Date(deck.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAddingCard(true)}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              + Add card
            </button>
            <Link
              to={`/study/${id}`}
              className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Study
            </Link>
          </div>
        </div>

        {/* Add card form */}
        {addingCard && (
          <form onSubmit={handleAddCard} className="bg-white rounded-2xl border border-brand-200 p-6 mb-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Add new card</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Front</label>
                <textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Question or term"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Back</label>
                <textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="Answer or definition"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAddingCard(false)} className="px-4 py-2 text-sm text-gray-500">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
                Add card
              </button>
            </div>
          </form>
        )}

        {/* Cards list */}
        <div className="space-y-3">
          {cards.map((card, index) => (
            <div key={card.id} className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
              {editing === card.id ? (
                <div className="p-5">
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Front</label>
                      <textarea
                        value={editFront}
                        onChange={(e) => setEditFront(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Back</label>
                      <textarea
                        value={editBack}
                        onChange={(e) => setEditBack(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
                    <button onClick={() => handleSaveCard(card.id)} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium">Save</button>
                  </div>
                </div>
              ) : (
                <div className="p-5 flex items-start gap-4">
                  <span className="text-xs text-gray-400 font-mono mt-1 min-w-[24px]">{index + 1}</span>
                  <div className="flex-1 grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-1">Front</p>
                      <p className="text-gray-900 text-sm">{card.front}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-1">Back</p>
                      <p className="text-gray-700 text-sm">{card.back}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(card)}
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {cards.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">No cards in this deck yet.</p>
            <button
              onClick={() => setAddingCard(true)}
              className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium"
            >
              Add your first card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
