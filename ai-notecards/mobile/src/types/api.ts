export type ApiUser = {
  id: string;
  email: string;
  display_name: string | null;
  plan: 'free' | 'trial' | 'pro';
  subscription_platform: 'stripe' | 'apple' | null;
  avatar_url: string | null;
  study_score: number;
  current_streak: number;
  longest_streak: number;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  has_seller_payout_account: boolean;
  seller_terms_accepted_at: string | null;
  connect_payouts_enabled: boolean;
  created_at: string;
  preferences?: Record<string, unknown>;
};

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  plan: 'free' | 'trial' | 'pro';
  subscriptionPlatform: 'stripe' | 'apple' | null;
  avatarUrl: string | null;
  studyScore: number;
  currentStreak: number;
  longestStreak: number;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  hasSellerPayoutAccount: boolean;
  sellerTermsAccepted: boolean;
  stripeConnectOnboarded: boolean;
  createdAt: string;
  preferences: Record<string, unknown>;
};

export type AuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
  isNewUser?: boolean;
};

export type AuthMeResponse = {
  user: User | null;
  dailyGenerationLimit?: number;
  deckCount?: number;
};

export type Deck = {
  id: string;
  userId: string;
  title: string;
  sourceText: string | null;
  origin: 'generated' | 'purchased';
  cardCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  position: number;
  createdAt: string;
};

export type DeckWithCards = Deck & {
  cards: Card[];
};

export type StudySession = {
  id: string;
  userId: string;
  deckId: string;
  mode: StudyMode;
  correct: number;
  totalCards: number;
  completedAt: string | null;
  createdAt: string;
};

export type StudyMode = 'flip' | 'multiple_choice' | 'type_answer' | 'match';

export type MarketplaceListing = {
  id: string;
  deckId: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  priceCents: number;
  status: 'active' | 'pending_review' | 'delisted' | 'removed';
  purchaseCount: number;
  averageRating: number;
  ratingCount: number;
  cardCount: number;
  sellerName: string;
  categoryName: string;
  tags: string[];
  previewCards: Card[];
  createdAt: string;
};

export type MarketplacePurchaseAvailability = {
  ios_native: {
    enabled: boolean;
    code: string | null;
    message: string | null;
  };
};

export type MarketplaceCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  listingCount: number;
};

export type Rating = {
  id: string;
  userId: string;
  listingId: string;
  stars: number;
  reviewText: string | null;
  userName: string;
  createdAt: string;
};

export type SellerDashboard = {
  totalEarnings: number;
  totalSales: number;
  activeListings: number;
  averageRating: number;
  listings: MarketplaceListing[];
};
