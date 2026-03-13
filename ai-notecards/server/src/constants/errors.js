// Structured error codes shared between backend and iOS client.
// iOS APIError enum mirrors these codes exactly.

export const ErrorCodes = {
  // Auth
  AUTH_REQUIRED: 'auth_required',
  AUTH_INVALID_TOKEN: 'auth_invalid_token',
  AUTH_EXPIRED_TOKEN: 'auth_expired_token',
  AUTH_ACCOUNT_SUSPENDED: 'auth_account_suspended',
  AUTH_ACCOUNT_DELETED: 'auth_account_deleted',
  AUTH_INVALID_CREDENTIALS: 'auth_invalid_credentials',
  AUTH_EMAIL_EXISTS: 'auth_email_exists',
  AUTH_USE_APPLE: 'auth_use_apple',

  // Plan / tier
  UPGRADE_REQUIRED: 'upgrade_required',
  GENERATION_LIMIT_REACHED: 'generation_limit_reached',
  DECK_LIMIT_REACHED: 'deck_limit_reached',

  // BYOK
  BYOK_KEY_REQUIRED: 'byok_key_required',
  BYOK_KEY_INVALID: 'byok_key_invalid',
  BYOK_INSUFFICIENT_CREDITS: 'byok_insufficient_credits',
  BYOK_RATE_LIMITED: 'byok_rate_limited',
  BYOK_PROVIDER_DOWN: 'byok_provider_down',

  // IAP
  IAP_VERIFICATION_FAILED: 'iap_verification_failed',
  IAP_ACCOUNT_MISMATCH: 'iap_account_mismatch',
  IAP_PRICE_MISMATCH: 'iap_price_mismatch',
  IAP_ALREADY_PURCHASED: 'iap_already_purchased',
  IAP_SELF_PURCHASE: 'iap_self_purchase',
  IAP_LISTING_UNAVAILABLE: 'iap_listing_unavailable',

  // Marketplace
  LISTING_NOT_FOUND: 'listing_not_found',
  LISTING_PRICE_CHANGED: 'listing_price_changed',

  // Generation
  AI_GENERATION_FAILED: 'ai_generation_failed',
  AI_PARSE_FAILED: 'ai_parse_failed',
  INPUT_TOO_LONG: 'input_too_long',

  // General
  VALIDATION_ERROR: 'validation_error',
  NOT_FOUND: 'not_found',
  SERVER_ERROR: 'server_error',
};
