import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { calculatePlatformFeeCents, calculateSellerEarningsCents, MARKETPLACE_PLATFORM_FEE_RATE } from '../lib/marketplace.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

const PRICE_OPTIONS = [
  { value: 100, label: '$1' },
  { value: 200, label: '$2' },
  { value: 300, label: '$3' },
  { value: 400, label: '$4' },
  { value: 500, label: '$5' },
];

export default function ListDeck() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deck, setDeck] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [priceCents, setPriceCents] = useState(300);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.connect_charges_enabled || !user?.seller_terms_accepted_at) {
      toast.error('Complete seller setup to list decks');
      navigate('/seller');
      return;
    }

    Promise.all([api.getDeck(deckId), api.getCategories()])
      .then(([deckData, catData]) => {
        setDeck(deckData);
        setCategories(catData.categories);
      })
      .catch((err) => {
        toast.error(err.message);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [deckId]);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && tags.length < 5 && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (t) => setTags(tags.filter((x) => x !== t));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const platformFee = calculatePlatformFeeCents(priceCents);
  const sellerEarnings = calculateSellerEarningsCents(priceCents);
  const platformFeeLabel = `${Math.round(MARKETPLACE_PLATFORM_FEE_RATE * 100)}%`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error('Please select a category');
      return;
    }
    if (!description.trim()) {
      toast.error('Please write a description');
      return;
    }

    setSubmitting(true);
    try {
      await api.createListing({
        deck_id: deckId,
        category_id: categoryId,
        description: description.trim(),
        price_cents: priceCents,
        tags,
      });
      toast.success('Deck listed on marketplace!');
      navigate('/seller');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-8" />
            <div className="h-12 bg-gray-100 rounded mb-4" />
            <div className="h-12 bg-gray-100 rounded mb-4" />
            <div className="h-32 bg-gray-100 rounded mb-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-[#1A1614] mb-2">List on Marketplace</h1>
        <p className="text-[#6B635A] mb-8">
          Sell "{deck?.deck?.title}" ({deck?.cards?.length || 0} cards)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[#1A1614] mb-1.5">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#1A1614] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will buyers learn from this deck?"
              maxLength={500}
              rows={4}
              required
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A] resize-none"
            />
            <p className="text-xs text-[#6B635A] mt-1">{description.length}/500</p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-[#1A1614] mb-1.5">Tags (up to 5)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-[#E8F5F0] text-[#1B6B5A] text-sm rounded-full">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-[#1B6B5A]/60 hover:text-[#1B6B5A]">
                    &times;
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                placeholder="Type a tag and press Enter"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
              />
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-[#1A1614] mb-1.5">Price</label>
            <div className="flex gap-2">
              {PRICE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriceCents(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl font-mono font-semibold text-sm transition-colors ${
                    priceCents === opt.value
                      ? 'bg-[#1B6B5A] text-white'
                      : 'bg-white border border-gray-200 text-[#1A1614] hover:border-[#1B6B5A]/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-[#6B635A] mt-2">
              You earn <span className="font-mono font-semibold text-[#1B6B5A]">${(sellerEarnings / 100).toFixed(2)}</span> after {platformFeeLabel} platform fee
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#1B6B5A] text-white rounded-xl font-semibold hover:bg-[#155a4a] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Listing...' : 'List for sale'}
          </button>
        </form>
      </div>
    </div>
  );
}
