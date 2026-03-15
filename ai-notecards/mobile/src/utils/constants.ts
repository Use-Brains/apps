export const TIER_LIMITS = {
  free: {
    generationsPerDay: 1,
    maxDecks: 10,
    canSell: false,
  },
  trial: {
    generationsPerDay: 10,
    maxDecks: Infinity,
    canSell: false,
  },
  pro: {
    generationsPerDay: 10,
    maxDecks: Infinity,
    canSell: true,
  },
} as const;

export const PRICING = {
  pro: {
    monthly: 9,
    currency: 'USD',
  },
  listing: {
    minCents: 100,
    maxCents: 500,
    platformFeePercent: 50,
  },
} as const;

export const MARKETPLACE_CATEGORIES = [
  { name: 'Science', slug: 'science' },
  { name: 'Mathematics', slug: 'mathematics' },
  { name: 'History', slug: 'history' },
  { name: 'Languages', slug: 'languages' },
  { name: 'Literature', slug: 'literature' },
  { name: 'Computer Science', slug: 'computer-science' },
  { name: 'Business', slug: 'business' },
  { name: 'Medical & Health', slug: 'medical-health' },
  { name: 'Psychology', slug: 'psychology' },
  { name: 'Arts & Music', slug: 'arts-music' },
  { name: 'Law', slug: 'law' },
  { name: 'Engineering', slug: 'engineering' },
  { name: 'Test Prep', slug: 'test-prep' },
] as const;

export const STUDY_MODES = [
  { id: 'flip', label: 'Flip Cards', description: 'Show front, tap to reveal back' },
  { id: 'multiple_choice', label: 'Multiple Choice', description: '4 options per card' },
  { id: 'type_answer', label: 'Type Answer', description: 'Type your answer, fuzzy matching' },
  { id: 'match', label: 'Match', description: 'Drag and drop matching game' },
] as const;

export const LISTING_CONSTRAINTS = {
  minCards: 10,
  maxActiveListing: 50,
  maxTags: 5,
  maxDescriptionLength: 1000,
} as const;

export const AI_LIMITS = {
  maxCardsPerGeneration: 25,
  hardCapCards: 30,
} as const;
