import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatPnlColor } from '../src/utils/format';

describe('formatCurrency', () => {
  it('formats positive values', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats with custom decimals', () => {
    expect(formatCurrency(42000.12345678, 8)).toBe('$42,000.12345678');
  });
});

describe('formatPercent', () => {
  it('formats positive with plus sign', () => {
    expect(formatPercent(5.5)).toBe('+5.50%');
  });

  it('formats negative', () => {
    expect(formatPercent(-3.2)).toBe('-3.20%');
  });

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercent(12.345, 1)).toBe('+12.3%');
  });
});

describe('formatPnlColor', () => {
  it('returns profit for positive', () => {
    expect(formatPnlColor(100)).toBe('profit');
  });

  it('returns loss for negative', () => {
    expect(formatPnlColor(-50)).toBe('loss');
  });

  it('returns neutral for zero', () => {
    expect(formatPnlColor(0)).toBe('neutral');
  });

  it('returns neutral for null', () => {
    expect(formatPnlColor(null)).toBe('neutral');
  });
});
