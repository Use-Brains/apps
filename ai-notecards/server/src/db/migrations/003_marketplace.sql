-- 003_marketplace.sql
-- Marketplace categories, listings, tags, purchases

CREATE TABLE marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Seed 13 categories
INSERT INTO marketplace_categories (name, slug, sort_order) VALUES
  ('Science', 'science', 1),
  ('Mathematics', 'mathematics', 2),
  ('History', 'history', 3),
  ('Languages', 'languages', 4),
  ('Literature', 'literature', 5),
  ('Computer Science', 'computer-science', 6),
  ('Business', 'business', 7),
  ('Medical & Health', 'medical-health', 8),
  ('Psychology', 'psychology', 9),
  ('Arts & Music', 'arts-music', 10),
  ('Law', 'law', 11),
  ('Engineering', 'engineering', 12),
  ('Test Prep', 'test-prep', 13);

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID UNIQUE NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES marketplace_categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents BETWEEN 100 AND 500),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'delisted', 'removed')),
  purchase_count INT NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  rating_count INT NOT NULL DEFAULT 0,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE listing_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(listing_id, tag)
);

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
  deck_id UUID NOT NULL REFERENCES decks(id),
  price_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, listing_id)
);

-- Indexes for browse queries
CREATE INDEX idx_listings_search ON marketplace_listings USING GIN (search_vector);
CREATE INDEX idx_listings_cat_popular ON marketplace_listings (category_id, purchase_count DESC) WHERE status = 'active';
CREATE INDEX idx_listings_cat_newest ON marketplace_listings (category_id, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_listings_popular ON marketplace_listings (purchase_count DESC) WHERE status = 'active';
CREATE INDEX idx_purchases_seller_date ON purchases (seller_id, created_at DESC);
CREATE INDEX idx_purchases_buyer ON purchases (buyer_id);
CREATE INDEX idx_listing_tags_listing ON listing_tags (listing_id);
