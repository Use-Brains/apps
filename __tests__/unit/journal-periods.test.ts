import { describe, it, expect } from 'vitest';
import {
  buildJournalPeriodOptions,
  getJournalPeriodKey,
  getJournalPeriodRange,
} from '../../src/utils/journal-periods';

describe('journal periods', () => {
  it('builds a full-day range for daily view', () => {
    const anchor = new Date('2026-03-10T12:00:00');
    const range = getJournalPeriodRange('daily', anchor);
    const start = new Date(range.dateFrom);
    const end = new Date(range.dateTo);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(10);
    expect(end.getTime() - start.getTime()).toBe(86_399_999);
  });

  it('builds an ISO-week range from monday to sunday', () => {
    const anchor = new Date('2026-01-01T12:00:00');
    const range = getJournalPeriodRange('weekly', anchor);
    const start = new Date(range.dateFrom);
    const end = new Date(range.dateTo);

    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(604_799_999);
  });

  it('builds month and year keys', () => {
    const anchor = new Date('2026-03-10T12:00:00');
    expect(getJournalPeriodKey('monthly', anchor)).toBe('2026-03');
    expect(getJournalPeriodKey('yearly', anchor)).toBe('2026');
  });

  it('formats daily range label with short weekday', () => {
    const anchor = new Date(2026, 2, 10, 12, 0, 0, 0);
    const range = getJournalPeriodRange('daily', anchor);
    expect(range.rangeLabel).toMatch(/^[A-Za-z]{3}, /);
  });

  it('includes the selected key in generated options for each view', () => {
    const anchor = new Date('2026-03-10T12:00:00');

    const daily = buildJournalPeriodOptions('daily', anchor);
    const weekly = buildJournalPeriodOptions('weekly', anchor);
    const monthly = buildJournalPeriodOptions('monthly', anchor);
    const yearly = buildJournalPeriodOptions('yearly', anchor);

    expect(daily.some((option) => option.key === getJournalPeriodKey('daily', anchor))).toBe(true);
    expect(weekly.some((option) => option.key === getJournalPeriodKey('weekly', anchor))).toBe(
      true
    );
    expect(monthly.some((option) => option.key === getJournalPeriodKey('monthly', anchor))).toBe(
      true
    );
    expect(yearly.some((option) => option.key === getJournalPeriodKey('yearly', anchor))).toBe(
      true
    );
  });

  it('keeps weekly options continuous across year boundaries', () => {
    const anchor = new Date('2026-01-01T12:00:00');
    const weekly = buildJournalPeriodOptions('weekly', anchor);
    const keys = weekly.map((option) => option.key);

    expect(keys).toContain('2026-W01');
    expect(keys).toContain('2025-W52');
    expect(keys).toContain('2025-W51');
  });
});
