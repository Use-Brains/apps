-- setup_demo_seller.sql
-- Creates or updates a demo seller account for testing.
-- Usage: psql $DATABASE_URL_DIRECT -f server/db/scripts/setup_demo_seller.sql
--
-- This sets up a user with:
-- - Pro plan (no expiry)
-- - Seller terms accepted
-- - Stripe Connect enabled (mocked — no real Stripe account)
-- - A generated deck with 12 cards (enough to list on marketplace)

-- 1. Create or update the demo seller user
INSERT INTO users (email, plan, seller_terms_accepted_at, seller_terms_version,
                   connect_charges_enabled, connect_payouts_enabled,
                   stripe_connect_account_id, display_name, email_verified)
VALUES (
  'ksakhakorn@gmail.com',
  'pro',
  NOW(),
  1,
  true,
  true,
  'acct_demo_seller_mock',
  'Demo Seller',
  true
)
ON CONFLICT (email) DO UPDATE SET
  plan = 'pro',
  seller_terms_accepted_at = COALESCE(users.seller_terms_accepted_at, NOW()),
  seller_terms_version = 1,
  connect_charges_enabled = true,
  connect_payouts_enabled = true,
  stripe_connect_account_id = COALESCE(users.stripe_connect_account_id, 'acct_demo_seller_mock'),
  display_name = COALESCE(users.display_name, 'Demo Seller'),
  email_verified = true
RETURNING id, email, plan, display_name;

-- 2. Create a demo deck with 12 cards (min 10 required to list)
DO $$
DECLARE
  seller_id UUID;
  deck_id UUID;
BEGIN
  SELECT id INTO seller_id FROM users WHERE email = 'ksakhakorn@gmail.com';

  -- Only create deck if seller doesn't have one yet
  IF NOT EXISTS (SELECT 1 FROM decks WHERE user_id = seller_id AND title = 'Demo: World Capitals') THEN
    INSERT INTO decks (user_id, title, source_text, origin)
    VALUES (seller_id, 'Demo: World Capitals', 'Demo deck for testing', 'generated')
    RETURNING id INTO deck_id;

    INSERT INTO cards (deck_id, front, back, position) VALUES
      (deck_id, 'What is the capital of France?', 'Paris', 0),
      (deck_id, 'What is the capital of Japan?', 'Tokyo', 1),
      (deck_id, 'What is the capital of Brazil?', 'Brasilia', 2),
      (deck_id, 'What is the capital of Australia?', 'Canberra', 3),
      (deck_id, 'What is the capital of Canada?', 'Ottawa', 4),
      (deck_id, 'What is the capital of Germany?', 'Berlin', 5),
      (deck_id, 'What is the capital of Italy?', 'Rome', 6),
      (deck_id, 'What is the capital of Spain?', 'Madrid', 7),
      (deck_id, 'What is the capital of India?', 'New Delhi', 8),
      (deck_id, 'What is the capital of South Korea?', 'Seoul', 9),
      (deck_id, 'What is the capital of Mexico?', 'Mexico City', 10),
      (deck_id, 'What is the capital of Egypt?', 'Cairo', 11);

    RAISE NOTICE 'Created deck "World Capitals" with 12 cards for ksakhakorn@gmail.com';
  ELSE
    RAISE NOTICE 'Demo deck already exists for ksakhakorn@gmail.com — skipping';
  END IF;
END $$;
