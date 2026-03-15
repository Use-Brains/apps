import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth-token';

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      data.message || data.error || `Request failed (${res.status})`,
      res.status,
      data
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  signup: (email: string, password: string) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Auth — Google
  authGoogle: (idToken: string) =>
    request('/auth-google', { method: 'POST', body: JSON.stringify({ idToken }) }),

  // Auth — Magic Link
  magicLinkRequest: (email: string) =>
    request('/auth-magic/request', { method: 'POST', body: JSON.stringify({ email }) }),
  magicLinkVerify: (email: string, code: string) =>
    request('/auth-magic/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),

  // Generate
  generate: (input: string, title?: string) =>
    request('/generate', { method: 'POST', body: JSON.stringify({ input, title }) }),

  // Decks
  getDecks: () => request('/decks'),
  getDeck: (id: string) => request(`/decks/${id}`),
  updateDeck: (id: string, title: string) =>
    request(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteDeck: (id: string) => request(`/decks/${id}`, { method: 'DELETE' }),
  duplicateDeck: (id: string) => request(`/decks/${id}/duplicate`, { method: 'POST' }),

  // Cards
  addCard: (deckId: string, front: string, back: string) =>
    request(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify({ front, back }) }),
  updateCard: (deckId: string, cardId: string, front: string, back: string) =>
    request(`/decks/${deckId}/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify({ front, back }) }),
  deleteCard: (deckId: string, cardId: string) =>
    request(`/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),

  // Study
  startSession: (deckId: string, mode: string) =>
    request('/study/start', { method: 'POST', body: JSON.stringify({ deckId, mode }) }),
  completeSession: (sessionId: string, correct: number, totalCards: number) =>
    request(`/study/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ correct, totalCards }) }),
  getStats: () => request('/study/stats'),
  getStudyHistory: (cursorDate?: string, cursorId?: string) => {
    const params = new URLSearchParams();
    if (cursorDate) params.set('cursor_date', cursorDate);
    if (cursorId) params.set('cursor_id', cursorId);
    return request(`/study/history?${params}`);
  },
  getDeckStats: () => request('/study/deck-stats'),

  // Settings
  getProfile: () => request('/settings'),
  updateProfile: (data: Record<string, unknown>) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  updatePreferences: (prefs: Record<string, unknown>) =>
    request('/settings/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),

  // Account
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/account/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (confirmation: string) =>
    request('/account', { method: 'DELETE', body: JSON.stringify({ confirmation }) }),

  // Marketplace
  getMarketplace: (params: Record<string, string>) =>
    request(`/marketplace?${new URLSearchParams(params)}`),
  getCategories: () => request('/marketplace/categories'),
  getListing: (id: string) => request(`/marketplace/${id}`),
  createPurchase: (listingId: string) =>
    request(`/marketplace/${listingId}/purchase`, { method: 'POST' }),
  flagListing: (listingId: string, reason: string, flagType = 'listing', ratingId?: string) =>
    request(`/marketplace/${listingId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason, flagType, ratingId }),
    }),

  // Seller
  getSellerDashboard: () => request('/seller/dashboard'),
  getSellerListings: () => request('/seller/listings'),
  createListing: (data: Record<string, unknown>) =>
    request('/seller/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id: string, data: Record<string, unknown>) =>
    request(`/seller/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delistListing: (id: string) =>
    request(`/seller/listings/${id}`, { method: 'DELETE' }),
  relistListing: (id: string) =>
    request(`/seller/listings/${id}/relist`, { method: 'POST' }),
  acceptSellerTerms: () => request('/seller/accept-terms', { method: 'POST' }),
  startSellerOnboarding: () => request('/seller/onboard', { method: 'POST' }),
  refreshOnboarding: () => request('/seller/onboard/refresh'),

  // Ratings
  submitRating: (listingId: string, stars: number, reviewText?: string) =>
    request('/ratings', { method: 'POST', body: JSON.stringify({ listingId, stars, reviewText }) }),
  getListingRatings: (listingId: string) => request(`/ratings/listing/${listingId}`),
};
