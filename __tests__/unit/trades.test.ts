import { describe, it, expect } from 'vitest';
import { calculatePnl } from '../../src/utils/pnl';

describe('calculatePnl', () => {
  it('calculates profit on long trade', () => {
    const result = calculatePnl({
      side: 'long',
      entry_price: 100,
      exit_price: 110,
      size: 10,
      fees: 5,
    });
    expect(result.pnl).toBe(95);
    expect(result.pnl_percent).toBe(9.5);
  });

  it('calculates loss on long trade', () => {
    const result = calculatePnl({
      side: 'long',
      entry_price: 100,
      exit_price: 90,
      size: 10,
      fees: 5,
    });
    expect(result.pnl).toBe(-105);
    expect(result.pnl_percent).toBe(-10.5);
  });

  it('calculates profit on short trade', () => {
    const result = calculatePnl({
      side: 'short',
      entry_price: 100,
      exit_price: 90,
      size: 10,
      fees: 5,
    });
    expect(result.pnl).toBe(95);
    expect(result.pnl_percent).toBe(9.5);
  });

  it('calculates loss on short trade', () => {
    const result = calculatePnl({
      side: 'short',
      entry_price: 100,
      exit_price: 110,
      size: 10,
      fees: 5,
    });
    expect(result.pnl).toBe(-105);
    expect(result.pnl_percent).toBe(-10.5);
  });

  it('handles zero fees', () => {
    const result = calculatePnl({
      side: 'long',
      entry_price: 50,
      exit_price: 60,
      size: 2,
      fees: 0,
    });
    expect(result.pnl).toBe(20);
    expect(result.pnl_percent).toBe(20);
  });

  it('handles crypto decimal prices', () => {
    const result = calculatePnl({
      side: 'long',
      entry_price: 42000.50,
      exit_price: 44100.75,
      size: 0.5,
      fees: 10,
    });
    expect(result.pnl).toBe(1040.125);
    // (1040.125 / (42000.50 * 0.5)) * 100
    expect(result.pnl_percent).toBeCloseTo(4.9529, 2);
  });

  it('handles breakeven trade', () => {
    const result = calculatePnl({
      side: 'long',
      entry_price: 100,
      exit_price: 100,
      size: 10,
      fees: 0,
    });
    expect(result.pnl).toBe(0);
    expect(result.pnl_percent).toBe(0);
  });

  it('handles breakeven minus fees', () => {
    const result = calculatePnl({
      side: 'long',
      entry_price: 100,
      exit_price: 100,
      size: 10,
      fees: 5,
    });
    expect(result.pnl).toBe(-5);
    expect(result.pnl_percent).toBe(-0.5);
  });
});
