type NotificationRoutingData = {
  type?: unknown;
  url?: unknown;
  listingId?: unknown;
};

const SUPPORTED_HOSTS = new Set(['ainotecards.com', 'www.ainotecards.com']);

export function getSupportedNotificationPath(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!SUPPORTED_HOSTS.has(parsed.host)) {
    return null;
  }

  const path = parsed.pathname.replace(/\/+$/, '') || '/';

  if (path === '/marketplace') {
    return '/marketplace';
  }

  if (path.startsWith('/marketplace/')) {
    return path;
  }

  if (path === '/verify-code') {
    const email = parsed.searchParams.get('email');
    return email ? `/verify-code?email=${encodeURIComponent(email)}` : '/verify-code';
  }

  if (path === '/seller/onboard/return') {
    return '/seller/onboard/return';
  }

  return null;
}

export function getRouteFromNotificationUrl(data: NotificationRoutingData | null | undefined) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  if (typeof data.url === 'string') {
    return getSupportedNotificationPath(data.url);
  }

  if (
    typeof data.type === 'string' &&
    (data.type === 'marketplace_sale' || data.type === 'purchase_ready') &&
    typeof data.listingId === 'string' &&
    data.listingId.length > 0
  ) {
    return `/marketplace/${data.listingId}`;
  }

  return null;
}

export function getNotificationPresentationBehavior(data: NotificationRoutingData | null | undefined) {
  const type = typeof data?.type === 'string' ? data.type : '';
  const isStudyReminder = type === 'daily_study_reminder' || type === 'streak_at_risk';

  if (isStudyReminder) {
    return {
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    };
  }

  return {
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  };
}
