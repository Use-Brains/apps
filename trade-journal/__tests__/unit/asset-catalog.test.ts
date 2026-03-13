import { describe, expect, it } from 'vitest';
import {
  getAssetSuggestions,
  normalizeAssetInput,
  resolveAssetSelection,
} from '../../src/features/assets/catalog';

describe('asset catalog', () => {
  it('normalizes mixed symbol input', () => {
    expect(normalizeAssetInput(' btc/usdt ')).toBe('BTCUSDT');
    expect(normalizeAssetInput('eur-usd')).toBe('EURUSD');
  });

  it('suggests BTC/USD first when typing BTC', () => {
    const suggestions = getAssetSuggestions('btc');
    expect(suggestions[0]?.symbol).toBe('BTC/USD');
  });

  it('prefers current class when duplicate symbols exist', () => {
    const suggestions = getAssetSuggestions('spy', {
      preferredAssetClass: 'options',
    });

    expect(suggestions[0]?.symbol).toBe('SPY');
    expect(suggestions[0]?.assetClass).toBe('options');
  });

  it('resolves crypto quote-base aliases to canonical USD symbol', () => {
    const resolved = resolveAssetSelection('BTC/USDT');
    expect(resolved?.symbol).toBe('BTC/USD');
    expect(resolved?.assetClass).toBe('crypto');
  });

  it('resolves exact selection with class preference', () => {
    const resolved = resolveAssetSelection('SPY', {
      preferredAssetClass: 'stocks',
    });

    expect(resolved?.symbol).toBe('SPY');
    expect(resolved?.assetClass).toBe('stocks');
  });
});
