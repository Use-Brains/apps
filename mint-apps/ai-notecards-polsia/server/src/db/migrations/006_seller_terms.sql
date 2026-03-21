-- 006_seller_terms.sql
-- Add seller terms tracking to users and delist timestamp to marketplace_listings

ALTER TABLE users
  ADD COLUMN seller_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN seller_terms_version INT;

ALTER TABLE marketplace_listings
  ADD COLUMN delisted_at TIMESTAMPTZ;
