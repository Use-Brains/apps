const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
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

  // Generate
  generate: (input, title) => request('/generate', { method: 'POST', body: JSON.stringify({ input, title }) }),

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
  flagListing: (listingId, reason) => request(`/marketplace/${listingId}/flag`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Seller
  getSellerDashboard: () => request('/seller/dashboard'),
  getSellerListings: () => request('/seller/listings'),
  createListing: (data) => request('/seller/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id, data) => request(`/seller/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delistListing: (id) => request(`/seller/listings/${id}`, { method: 'DELETE' }),
  startSellerOnboarding: () => request('/seller/onboard', { method: 'POST' }),
  refreshOnboarding: () => request('/seller/onboard/refresh'),

  // Ratings
  submitRating: (listingId, stars) => request('/ratings', { method: 'POST', body: JSON.stringify({ listingId, stars }) }),
  getListingRatings: (listingId) => request(`/ratings/listing/${listingId}`),

  // Admin
  getFlags: () => request('/admin/flags'),
  resolveFlag: (id, data) => request(`/admin/flags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
