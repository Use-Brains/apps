export function getApiBaseUrl(env = import.meta.env ?? {}) {
  return env.VITE_API_URL || '/api';
}

export function getFeatureAvailability(user, featureKey) {
  return user?.feature_availability?.[featureKey] || {
    enabled: true,
    code: null,
    message: null,
  };
}

export function getSellerToolsAvailability(user) {
  return getFeatureAvailability(user, 'seller_tools');
}

export function getSellerToolsMode(user) {
  const availability = getSellerToolsAvailability(user);

  return {
    ...availability,
    readOnly: !availability.enabled,
  };
}
