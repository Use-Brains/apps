export type OfflineBannerState = {
  visible: boolean;
  message: string;
};

export function getOfflineBannerState({
  isOnline,
  isSyncing,
}: {
  isOnline: boolean;
  isSyncing: boolean;
}): OfflineBannerState {
  if (!isOnline) {
    return {
      visible: true,
      message: "You're offline. Downloaded decks still work.",
    };
  }

  if (isSyncing) {
    return {
      visible: true,
      message: 'Back online. Syncing your offline progress...',
    };
  }

  return {
    visible: false,
    message: '',
  };
}

export function getOfflineFeatureMessage(feature: 'generate' | 'marketplace' | 'billing') {
  switch (feature) {
    case 'generate':
      return 'Flashcard generation requires an internet connection.';
    case 'marketplace':
      return 'Marketplace browsing and purchases require an internet connection.';
    case 'billing':
      return 'Billing management requires an internet connection.';
    default:
      return 'This feature requires an internet connection.';
  }
}

export function getOfflineStatsLabel(isOnline: boolean) {
  return isOnline ? null : 'Stats may be stale until your next refresh.';
}
