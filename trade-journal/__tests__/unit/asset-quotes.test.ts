import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearQuoteCache,
  fetchCurrentPrice,
  fetchCurrentPriceForAsset,
  fetchCurrentPrices,
  formatDisplayPrice,
  roundPrefillPrice,
} from '../../src/features/assets/quotes';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  clearQuoteCache();
  vi.restoreAllMocks();
});

describe('asset quotes', () => {
  it('returns regularMarketPrice from quote response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quoteResponse: {
          result: [{ symbol: 'AAPL', regularMarketPrice: 123.45 }],
        },
      }),
    }) as unknown as typeof fetch;

    const price = await fetchCurrentPrice('AAPL');
    expect(price).toBe(123.45);
  });

  it('returns null when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const price = await fetchCurrentPrice('AAPL');
    expect(price).toBeNull();
  });

  it('returns null when quote payload has no price', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quoteResponse: { result: [{}] } }),
    }) as unknown as typeof fetch;

    const price = await fetchCurrentPrice('AAPL');
    expect(price).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    const price = await fetchCurrentPrice('AAPL');
    expect(price).toBeNull();
  });

  it('returns a symbol->price map for batch quotes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quoteResponse: {
          result: [
            { symbol: 'AAPL', regularMarketPrice: 199.1 },
            { symbol: 'NVDA', regularMarketPrice: 950.5 },
          ],
        },
      }),
    }) as unknown as typeof fetch;

    const prices = await fetchCurrentPrices(['AAPL', 'NVDA']);
    expect(prices).toEqual({
      AAPL: 199.1,
      NVDA: 950.5,
    });
  });

  it('uses null fallback per symbol when batch fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    const prices = await fetchCurrentPrices(['AAPL', 'NVDA']);
    expect(prices).toEqual({
      AAPL: null,
      NVDA: null,
    });
  });

  it('uses asset quote symbol helper', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quoteResponse: { result: [{ symbol: 'SPY', regularMarketPrice: 99 }] },
      }),
    }) as unknown as typeof fetch;

    const price = await fetchCurrentPriceForAsset({
      symbol: 'SPY',
      displayName: 'SPY',
      assetClass: 'stocks',
      quoteSymbol: 'SPY',
      popularity: 1,
      aliases: [],
    });

    expect(price).toBe(99);
  });

  it('rounds prefill price to avoid long floating tails', () => {
    expect(roundPrefillPrice(1.23456789123)).toBe(1.23456789);
  });

  it('formats suggestion prices for display', () => {
    expect(formatDisplayPrice(undefined)).toBe('...');
    expect(formatDisplayPrice(null)).toBe('N/A');
    expect(formatDisplayPrice(1500.1234)).toBe('$1,500.12');
    expect(formatDisplayPrice(25.6789)).toBe('$25.68');
    expect(formatDisplayPrice(0.987654321)).toBe('$0.987654');
  });
});
