const BASE = '/api';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: isFormData
      ? { 'X-Requested-With': 'XMLHttpRequest', ...optHeaders }
      : { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...optHeaders },
    credentials: 'include',
    ...restOptions,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return res.json();
}

export const api = {
  // Auth
  signup: (email, password) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Auth — Google
  authGoogle: (idToken) => request('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),

  // Auth — Magic Link
  magicLinkRequest: (email) => request('/auth/magic-link/request', { method: 'POST', body: JSON.stringify({ email }) }),
  magicLinkVerify: (email, code) => request('/auth/magic-link/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),

  // Generate
  generate: (input, title) => request('/generate', { method: 'POST', body: JSON.stringify({ input, title }) }),
  generateWithPhotos: (input, title, files) => {
    const form = new FormData();
    if (input) form.append('input', input);
    if (title) form.append('title', title);
    files.forEach(f => form.append('photos', f));
    return request('/generate', { method: 'POST', body: form });
  },

  // Decks
  getDecks: () => request('/decks'),
  getDeck: (id) => request(`/decks/${id}`),
  updateDeck: (id, title) => request(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteDeck: (id) => request(`/decks/${id}`, { method: 'DELETE' }),

  // Cards
  addCard: (deckId, front, back) => request(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify({ front, back }) }),
  updateCard: (deckId, cardId, front, back) => request(`/decks/${deckId}/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify({ front, back }) }),
  deleteCard: (deckId, cardId) => request(`/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),

  // Study
  startSession: (deckId) => request('/study', { method: 'POST', body: JSON.stringify({ deckId }) }),
  completeSession: (sessionId, correct, totalCards) => request(`/study/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ correct, totalCards }) }),
  getStats: () => request('/study/stats'),

  // Stripe
  createCheckout: () => request('/stripe/checkout', { method: 'POST' }),
  cancelSubscription: () => request('/stripe/cancel', { method: 'POST' }),

  // Settings
  getProfile: () => request('/settings'),
  updateProfile: (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Marketplace
  getMarketplace: (params) => request(`/marketplace?${new URLSearchParams(params)}`),
  getCategories: () => request('/marketplace/categories'),
  getListing: (id) => request(`/marketplace/${id}`),
  createPurchase: (listingId) => request(`/marketplace/${listingId}/purchase`, { method: 'POST' }),
  flagListing: (listingId, reason, flagType = 'listing', ratingId = null) => request(`/marketplace/${listingId}/flag`, { method: 'POST', body: JSON.stringify({ reason, flagType, ratingId }) }),

  // Seller
  getSellerDashboard: () => request('/seller/dashboard'),
  getSellerListings: () => request('/seller/listings'),
  createListing: (data) => request('/seller/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id, data) => request(`/seller/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delistListing: (id) => request(`/seller/listings/${id}`, { method: 'DELETE' }),
  relistListing: (id) => request(`/seller/listings/${id}/relist`, { method: 'POST' }),
  acceptSellerTerms: () => request('/seller/accept-terms', { method: 'POST' }),
  startSellerOnboarding: () => request('/seller/onboard', { method: 'POST' }),
  refreshOnboarding: () => request('/seller/onboard/refresh'),

  // Ratings
  submitRating: (listingId, stars, reviewText) => request('/ratings', { method: 'POST', body: JSON.stringify({ listingId, stars, reviewText }) }),
  getListingRatings: (listingId) => request(`/ratings/listing/${listingId}`),

  // Admin
  getFlags: () => request('/admin/flags'),
  resolveFlag: (id, data) => request(`/admin/flags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
