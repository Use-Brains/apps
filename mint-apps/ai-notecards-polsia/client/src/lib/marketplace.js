const configuredRate = Number(import.meta.env.VITE_MARKETPLACE_PLATFORM_FEE_RATE ?? 0.5);

export const MARKETPLACE_PLATFORM_FEE_RATE =
  Number.isFinite(configuredRate) && configuredRate >= 0 && configuredRate <= 1
    ? configuredRate
    : 0.5;

export function calculatePlatformFeeCents(priceCents) {
  return Math.round(priceCents * MARKETPLACE_PLATFORM_FEE_RATE);
}

export function calculateSellerEarningsCents(priceCents) {
  return priceCents - calculatePlatformFeeCents(priceCents);
}
