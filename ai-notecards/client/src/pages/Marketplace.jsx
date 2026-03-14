import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
];

function StarRating({ rating, count }) {
  if (count < 3) {
    return <span className="px-1.5 py-0.5 bg-[#E8F5F0] text-[#1B6B5A] text-xs font-medium rounded">New</span>;
  }
  return (
    <div className="flex items-center gap-1">
      <svg className="w-4 h-4 text-[#C8A84E]" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-sm font-medium text-[#1A1614]">{Number(rating).toFixed(1)}</span>
      <span className="text-xs text-[#6B635A]">({count})</span>
    </div>
  );
}

function ListingCard({ listing }) {
  return (
    <Link
      to={`/marketplace/${listing.id}`}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-1 transition-all duration-250 group"
    >
      <div className="h-1 bg-[#1B6B5A]" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-[#1A1614] group-hover:text-[#1B6B5A] transition-colors line-clamp-2 text-sm">
            {listing.title}
          </h3>
          <span className="font-mono text-lg font-bold text-[#1A1614] shrink-0">
            ${listing.price_cents / 100}
          </span>
        </div>
        <p className="text-xs text-[#6B635A] line-clamp-2 mb-3">{listing.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B635A]">{listing.card_count} cards</span>
            <span className="text-xs text-[#6B635A]">·</span>
            <span className="text-xs text-[#1B6B5A] font-medium">{listing.category_name}</span>
          </div>
          <StarRating rating={listing.average_rating} count={listing.rating_count} />
        </div>
        {listing.seller_name && (
          <p className="text-xs text-[#6B635A] mt-2">by {listing.seller_name}</p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-1 bg-gray-200" />
      <div className="p-5">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-full mb-1" />
        <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api.getCategories().then((data) => setCategories(data.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { sort };
    if (activeCategory) params.category = activeCategory;
    if (search.trim()) params.q = search.trim();

    api.getMarketplace(params)
      .then((data) => {
        setListings(data.listings);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCategory, sort, search]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const params = { sort, cursor: nextCursor };
    if (activeCategory) params.category = activeCategory;
    if (search.trim()) params.q = search.trim();

    try {
      const data = await api.getMarketplace(params);
      setListings((prev) => [...prev, ...data.listings]);
      setNextCursor(data.nextCursor);
    } catch {}
    setLoadingMore(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1A1614] mb-2">Deck Marketplace</h1>
          <p className="text-[#6B635A]">Discover and buy flashcard decks from other learners</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search decks by topic, title, or keyword..."
              className="w-full px-5 py-3 pl-12 bg-white border border-gray-200 rounded-xl text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30 focus:border-[#1B6B5A]"
            />
            <svg className="w-5 h-5 text-[#6B635A] absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Category pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !activeCategory ? 'bg-[#1B6B5A] text-white' : 'bg-white text-[#6B635A] border border-gray-200 hover:border-[#1B6B5A]/30'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.slug ? null : cat.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.slug ? 'bg-[#1B6B5A] text-white' : 'bg-white text-[#6B635A] border border-gray-200 hover:border-[#1B6B5A]/30'
              }`}
            >
              {cat.name}
              {cat.listing_count > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{cat.listing_count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[#6B635A]">
            {loading ? '' : `${listings.length}${nextCursor ? '+' : ''} decks`}
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-[#1A1614] focus:outline-none focus:ring-2 focus:ring-[#1B6B5A]/30"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Listings grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-[#1A1614] mb-2">
              {search ? 'No decks found' : 'No decks in this category yet'}
            </h2>
            <p className="text-[#6B635A] mb-4">
              {search ? 'Try different keywords or browse by category.' : 'Be the first to publish!'}
            </p>
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="text-[#1B6B5A] font-medium hover:underline"
              >
                Browse all categories
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {nextCursor && (
              <div className="text-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-white border border-gray-200 text-[#1A1614] rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
