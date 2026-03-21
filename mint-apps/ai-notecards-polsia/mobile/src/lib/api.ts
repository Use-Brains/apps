import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type {
  ApiUser,
  AuthMeResponse,
  AuthSessionResponse,
  Card,
  Deck,
  DeckWithCards,
  StudyMode,
  User,
} from '@/types/api';

const ACCESS_TOKEN_KEY = 'auth-access-token';
const REFRESH_TOKEN_KEY = 'auth-refresh-token';
const NATIVE_CLIENT_HEADER = 'X-Client-Platform';
const NATIVE_CLIENT_VALUE = 'ios-native';

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3001/api';

let refreshPromise: Promise<AuthSessionResponse | null> | null = null;

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

type RequestOptions = RequestInit & {
  skipAuthRetry?: boolean;
};

function normalizeUser(user: ApiUser): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    plan: user.plan,
    subscriptionPlatform: user.subscription_platform,
    avatarUrl: user.avatar_url,
    studyScore: user.study_score,
    currentStreak: user.current_streak,
    longestStreak: user.longest_streak,
    trialEndsAt: user.trial_ends_at,
    cancelAtPeriodEnd: !!user.cancel_at_period_end,
    cancelAt: user.cancel_at,
    hasSellerPayoutAccount: !!user.has_seller_payout_account,
    sellerTermsAccepted: !!user.seller_terms_accepted_at,
    stripeConnectOnboarded: !!user.connect_payouts_enabled,
    createdAt: user.created_at,
    preferences: user.preferences && typeof user.preferences === 'object' ? user.preferences : {},
  };
}

function normalizeSessionResponse(payload: Record<string, unknown>): AuthSessionResponse {
  return {
    accessToken: String(payload.accessToken),
    refreshToken: String(payload.refreshToken),
    user: normalizeUser(payload.user as ApiUser),
    isNewUser: Boolean(payload.isNewUser),
  };
}

function normalizeMeResponse(payload: Record<string, unknown>): AuthMeResponse {
  return {
    user: payload.user ? normalizeUser(payload.user as ApiUser) : null,
    dailyGenerationLimit: typeof payload.daily_generation_limit === 'number' ? payload.daily_generation_limit : undefined,
    deckCount: typeof payload.deck_count === 'number' ? payload.deck_count : undefined,
  };
}

function normalizeDeck(deck: Record<string, unknown>): Deck {
  return {
    id: String(deck.id),
    userId: String(deck.user_id),
    title: String(deck.title),
    sourceText: typeof deck.source_text === 'string' ? deck.source_text : null,
    origin: deck.origin === 'purchased' ? 'purchased' : 'generated',
    archivedAt: typeof deck.archived_at === 'string' ? deck.archived_at : null,
    cardCount: typeof deck.card_count === 'number' ? deck.card_count : 0,
    createdAt: String(deck.created_at),
    updatedAt: String(deck.updated_at),
  };
}

function normalizeCard(card: Record<string, unknown>): Card {
  return {
    id: String(card.id),
    deckId: String(card.deck_id),
    front: String(card.front),
    back: String(card.back),
    position: typeof card.position === 'number' ? card.position : 0,
    createdAt: String(card.created_at),
  };
}

function getDeviceInfo() {
  return {
    platform: Platform.OS,
    deviceName: Constants.deviceName ?? 'Unknown Device',
    osVersion: String(Platform.Version ?? 'unknown'),
    appVersion: Constants.expoConfig?.version ?? '0.1.0',
  };
}

async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function hasStoredRefreshToken(): Promise<boolean> {
  return !!(await getRefreshToken());
}

export async function setSessionTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSessionTokens(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

async function refreshSession(): Promise<AuthSessionResponse | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE,
      },
      body: JSON.stringify({ refreshToken, deviceInfo: getDeviceInfo() }),
    }).catch((error) => {
      throw error;
    });

    if (res.status === 401 || res.status === 403) {
      await clearSessionTokens();
      return null;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(
        String(data.message || data.error || `Request failed (${res.status})`),
        res.status,
        data,
      );
    }

    const payload = normalizeSessionResponse(await res.json() as Record<string, unknown>);
    try {
      await setSessionTokens(payload.accessToken, payload.refreshToken);
    } catch (error) {
      await clearSessionTokens();
      throw error;
    }
    return payload;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function shouldRetryWithRefresh(path: string) {
  return ![
    '/auth/login',
    '/auth/signup',
    '/auth/google',
    '/auth/apple',
    '/auth/magic-link/request',
    '/auth/magic-link/verify',
    '/auth/refresh',
    '/auth/logout',
  ].includes(path);
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRetry = false, ...fetchOptions } = options;
  const token = await getAccessToken();
  const isFormData = fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE,
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(fetchOptions.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401 && !skipAuthRetry && shouldRetryWithRefresh(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, skipAuthRetry: true });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      String(data.message || data.error || `Request failed (${res.status})`),
      res.status,
      data,
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  signup: async (email: string, password: string): Promise<AuthSessionResponse> => {
    const payload = await request<Record<string, unknown>>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceInfo: getDeviceInfo() }),
    });
    return normalizeSessionResponse(payload);
  },
  login: async (email: string, password: string): Promise<AuthSessionResponse> => {
    const payload = await request<Record<string, unknown>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceInfo: getDeviceInfo() }),
    });
    return normalizeSessionResponse(payload);
  },
  authGoogle: async (idToken: string): Promise<AuthSessionResponse> => {
    const payload = await request<Record<string, unknown>>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, deviceInfo: getDeviceInfo() }),
    });
    return normalizeSessionResponse(payload);
  },
  authApple: async (identityToken: string, fullName?: string | null): Promise<AuthSessionResponse> => {
    const payload = await request<Record<string, unknown>>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, fullName, deviceInfo: getDeviceInfo() }),
    });
    return normalizeSessionResponse(payload);
  },
  magicLinkRequest: (email: string) =>
    request<{ ok: boolean }>('/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  magicLinkVerify: async (email: string, code: string): Promise<AuthSessionResponse> => {
    const payload = await request<Record<string, unknown>>('/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, deviceInfo: getDeviceInfo() }),
    });
    return normalizeSessionResponse(payload);
  },
  logout: async () => {
    const refreshToken = await getRefreshToken();
    return request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuthRetry: true,
    });
  },
  me: async (): Promise<AuthMeResponse> => {
    const payload = await request<Record<string, unknown>>('/auth/me', { skipAuthRetry: true });
    return normalizeMeResponse(payload);
  },
  reconcileRevenueCat: async (): Promise<AuthMeResponse> => {
    const payload = await request<Record<string, unknown>>('/revenuecat/reconcile', {
      method: 'POST',
      skipAuthRetry: true,
    });
    return normalizeMeResponse(payload);
  },
  createStripeCheckout: (billingPeriod: 'monthly' | 'annual' = 'monthly') =>
    request<{ url: string }>('/stripe/checkout', { method: 'POST', body: JSON.stringify({ billingPeriod }) }),
  createBillingPortal: () =>
    request<{ url: string }>('/stripe/portal', { method: 'POST' }),

  generate: (input: string, title?: string) =>
    request('/generate', { method: 'POST', body: JSON.stringify({ input, title }) }),
  generatePreview: (input: string, title?: string) =>
    request<{ cards: Array<{ front: string; back: string }>; generationsRemaining?: number }>(
      '/generate/preview',
      { method: 'POST', body: JSON.stringify({ input, title }) },
    ),
  generatePreviewWithPhotos: (
    input: string,
    title: string | undefined,
    photos: Array<{ uri: string; mimeType?: string }>,
  ) => {
    const form = new FormData();
    if (input) form.append('input', input);
    if (title) form.append('title', title);
    photos.forEach((photo, i) => {
      // React Native FormData accepts a file-like object with uri/type/name
      form.append('photos', { uri: photo.uri, type: photo.mimeType ?? 'image/jpeg', name: `photo_${i}.jpg` } as unknown as Blob);
    });
    return request<{ cards: Array<{ front: string; back: string }>; generationsRemaining?: number }>(
      '/generate/preview',
      { method: 'POST', body: form },
    );
  },
  saveDeck: (title: string, sourceText: string | null, cards: Array<{ front: string; back: string }>) =>
    request<{ deck: Record<string, unknown> }>('/decks/save', {
      method: 'POST',
      body: JSON.stringify({ title, source_text: sourceText, cards }),
    }),
  getDecks: async (): Promise<{ decks: Deck[] }> => {
    const payload = await request<{ decks: Record<string, unknown>[] }>('/decks');
    return {
      decks: payload.decks.map(normalizeDeck),
    };
  },
  getDeck: async (id: string): Promise<{ deck: DeckWithCards; cards: Card[] }> => {
    const payload = await request<{ deck: Record<string, unknown>; cards: Record<string, unknown>[] }>(`/decks/${id}`);
    const cards = payload.cards.map(normalizeCard);
    return {
      deck: {
        ...normalizeDeck(payload.deck),
        cards,
      },
      cards,
    };
  },
  updateDeck: (id: string, title: string) =>
    request(`/decks/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteDeck: (id: string) => request(`/decks/${id}`, { method: 'DELETE' }),
  archiveDeck: (id: string) => request<{ deck: { id: string; archived_at: string | null } }>(`/decks/${id}/archive`, { method: 'POST' }),
  unarchiveDeck: (id: string) => request<{ deck: { id: string; archived_at: string | null } }>(`/decks/${id}/unarchive`, { method: 'POST' }),
  duplicateDeck: (id: string) => request(`/decks/${id}/duplicate`, { method: 'POST' }),
  addCard: (deckId: string, front: string, back: string) =>
    request(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify({ front, back }) }),
  updateCard: (deckId: string, cardId: string, front: string, back: string) =>
    request(`/decks/${deckId}/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify({ front, back }) }),
  deleteCard: (deckId: string, cardId: string) =>
    request(`/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),
  startSession: (deckId: string, mode: StudyMode) =>
    request('/study', { method: 'POST', body: JSON.stringify({ deckId, mode }) }),
  completeSession: (sessionId: string, correct: number, totalCards: number) =>
    request(`/study/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ correct, totalCards }) }),
  syncStudySessions: (sessions: Record<string, unknown>[]) =>
    request<{ acceptedSessionIds: string[]; dedupedSessionIds: string[]; streak?: Record<string, unknown> }>(
      '/study/sync',
      { method: 'POST', body: JSON.stringify({ sessions }) },
    ),
  getStats: () => request('/study/stats'),
  getStudyHistory: (cursorDate?: string, cursorId?: string) => {
    const params = new URLSearchParams();
    if (cursorDate) params.set('cursor_date', cursorDate);
    if (cursorId) params.set('cursor_id', cursorId);
    return request(`/study/history?${params}`);
  },
  getDeckStats: () => request('/study/deck-stats'),
  getProfile: () => request('/settings'),
  updateProfile: (data: Record<string, unknown>) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  updatePreferences: (prefs: Record<string, unknown>) =>
    request('/settings/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
  registerNotificationDevice: (device: { token: string; timezone: string; permissionStatus: 'granted' | 'denied' | 'undetermined' }) =>
    request('/notifications/devices', { method: 'POST', body: JSON.stringify(device) }),
  unregisterNotificationDevice: (token: string) =>
    request(`/notifications/devices/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  changePassword: (currentPassword: string | null, newPassword: string) =>
    request('/account/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (confirmation: string) =>
    request('/account', { method: 'DELETE', body: JSON.stringify({ confirmation }) }),
  getMarketplace: (params: Record<string, string>) =>
    request(`/marketplace?${new URLSearchParams(params)}`),
  getCategories: () => request('/marketplace/categories'),
  getListing: (id: string) => request(`/marketplace/${id}`),
  createPurchase: (listingId: string) =>
    request<{ url: string }>(`/marketplace/${listingId}/purchase`, { method: 'POST' }),
  flagListing: (listingId: string, reason: string, flagType = 'listing', ratingId?: string) =>
    request(`/marketplace/${listingId}/flag`, {
      method: 'POST',
      body: JSON.stringify({ reason, flagType, ratingId }),
    }),
  getSellerDashboard: () => request('/seller/dashboard'),
  getSellerListings: () => request('/seller/listings'),
  createListing: (data: Record<string, unknown>) =>
    request('/seller/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (id: string, data: Record<string, unknown>) =>
    request(`/seller/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delistListing: (id: string) => request(`/seller/listings/${id}`, { method: 'DELETE' }),
  relistListing: (id: string) => request(`/seller/listings/${id}/relist`, { method: 'POST' }),
  acceptSellerTerms: () => request('/seller/accept-terms', { method: 'POST' }),
  startSellerOnboarding: () => request('/seller/onboard', { method: 'POST' }),
  refreshOnboarding: () => request('/seller/onboard/refresh'),
  submitRating: (listingId: string, stars: number, reviewText?: string) =>
    request('/ratings', { method: 'POST', body: JSON.stringify({ listingId, stars, reviewText }) }),
  getListingRatings: (listingId: string) => request(`/ratings/listing/${listingId}`),
};

export { refreshSession };
