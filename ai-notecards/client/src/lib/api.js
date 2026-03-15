const BASE = '/api';

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { headers: optHeaders, signal, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: isFormData
      ? { 'X-Requested-With': 'XMLHttpRequest', ...optHeaders }
      : { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...optHeaders },
    credentials: 'include',
    signal,
    ...restOptions,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
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
  generatePreview: (input, title, options = {}) => request('/generate/preview', { method: 'POST', body: JSON.stringify({ input, title }), ...options }),
  generatePreviewWithPhotos: (input, title, files, options = {}) => {
    const form = new FormData();
    if (input) form.append('input', input);
    if (title) form.append('title', title);
    files.forEach(f => form.append('photos', f));
    return request('/generate/preview', { method: 'POST', body: form, ...options });
  },
  saveDeck: (title, sourceText, cards) => request('/decks/save', { method: 'POST', body: JSON.stringify({ title, source_text: sourceText, cards }) }),

  // Decks
  getDecks: () => request('/decks'),
  getDeck: (id) => request(`/decks/${id}`),
  updateDeck: (id, title) => request(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteDeck: (id) => request(`/decks/${id}`, { method: 'DELETE' }),
  duplicateDeck: (id, options = {}) => request(`/decks/${id}/duplicate`, { method: 'POST', ...options }),

  // Cards
  addCard: (deckId, front, back) => request(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify({ front, back }) }),
  updateCard: (deckId, cardId, front, back) => request(`/decks/${deckId}/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify({ front, back }) }),
  deleteCard: (deckId, cardId) => request(`/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),

  // Study
  startSession: (deckId, mode) => request('/study', { method: 'POST', body: JSON.stringify({ deckId, mode }) }),
  completeSession: (sessionId, correct, totalCards) => request(`/study/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ correct, totalCards }) }),
  getStats: () => request('/study/stats'),

  // Stripe
  createCheckout: () => request('/stripe/checkout', { method: 'POST' }),
  cancelSubscription: () => request('/stripe/cancel', { method: 'POST' }),
  createBillingPortal: () => request('/stripe/portal', { method: 'POST' }),

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

  // Account
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return request('/account/avatar', { method: 'POST', body: form });
  },
  deleteAvatar: () => request('/account/avatar', { method: 'DELETE' }),
  changePassword: (currentPassword, newPassword) => request('/account/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (confirmation) => request('/account', { method: 'DELETE', body: JSON.stringify({ confirmation }) }),

  // Study — extended
  getStudyHistory: (cursorDate, cursorId) => {
    const params = new URLSearchParams();
    if (cursorDate) params.set('cursor_date', cursorDate);
    if (cursorId) params.set('cursor_id', cursorId);
    return request(`/study/history?${params}`);
  },
  getDeckStats: () => request('/study/deck-stats'),

  // Settings — extended
  updatePreferences: (prefs) => request('/settings/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
  exportDecks: () => fetch('/api/settings/export', {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  }),

  // Ratings
  submitRating: (listingId, stars, reviewText) => request('/ratings', { method: 'POST', body: JSON.stringify({ listingId, stars, reviewText }) }),
  getListingRatings: (listingId) => request(`/ratings/listing/${listingId}`),

  // Admin
  getFlags: () => request('/admin/flags'),
  resolveFlag: (id, data) => request(`/admin/flags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
