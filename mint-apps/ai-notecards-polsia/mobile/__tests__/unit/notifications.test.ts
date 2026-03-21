import { describe, expect, it } from 'vitest';

import {
  getNotificationPresentationBehavior,
  getRouteFromNotificationUrl,
  getSupportedNotificationPath,
} from '../../src/lib/notification-helpers';

describe('notification helpers', () => {
  it('maps supported universal links to native routes', () => {
    expect(getSupportedNotificationPath('https://ainotecards.com/marketplace')).toBe('/marketplace');
    expect(getSupportedNotificationPath('https://ainotecards.com/marketplace/listing-1')).toBe('/marketplace/listing-1');
    expect(getSupportedNotificationPath('https://ainotecards.com/verify-code?email=test@example.com')).toBe(
      '/verify-code?email=test%40example.com',
    );
    expect(getSupportedNotificationPath('https://ainotecards.com/seller/onboard/return')).toBe('/seller/onboard/return');
  });

  it('ignores unsupported hosts and paths', () => {
    expect(getSupportedNotificationPath('https://example.com/marketplace')).toBeNull();
    expect(getSupportedNotificationPath('https://ainotecards.com/settings')).toBeNull();
  });

  it('prefers an explicit notification url when present', () => {
    expect(getRouteFromNotificationUrl({
      url: 'https://ainotecards.com/marketplace/listing-1',
      listingId: 'ignored',
    })).toBe('/marketplace/listing-1');
  });

  it('falls back to marketplace route hints when the payload omits a url', () => {
    expect(getRouteFromNotificationUrl({
      type: 'marketplace_sale',
      listingId: 'listing-1',
    })).toBe('/marketplace/listing-1');
  });

  it('suppresses foreground alerts for study reminders', () => {
    expect(getNotificationPresentationBehavior({ type: 'daily_study_reminder' })).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    });
  });

  it('allows foreground alerts for marketplace activity', () => {
    expect(getNotificationPresentationBehavior({ type: 'marketplace_sale' })).toEqual({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });
});
