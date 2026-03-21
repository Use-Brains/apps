/**
 * Single PostHog owner — all PostHog calls go through this module.
 * No @posthog/react, no PostHogProvider, no static imports.
 * PostHog SDK is loaded via dynamic import() only after consent is granted.
 */

let initPromise = null;
let posthog = null;
let consentGranted = typeof localStorage !== 'undefined'
  && localStorage.getItem('analytics_consent') === 'granted';

export function initPostHog() {
  if (initPromise) return initPromise;
  const key = import.meta.env.VITE_POSTHOG_API_KEY;
  if (!key) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }
  initPromise = import('posthog-js').then(({ default: ph }) => {
    ph.init(key, {
      api_host: 'https://us.i.posthog.com',
      opt_out_capturing_by_default: true,
      person_profiles: 'identified_only',
    });
    posthog = ph;
    return ph;
  }).catch((err) => {
    warn(err);
    return null;
  });
  return initPromise;
}

export function updateConsent(granted) {
  consentGranted = granted;
  localStorage.setItem('analytics_consent', granted ? 'granted' : 'declined');
}

function warn(err) {
  if (import.meta.env.DEV) console.warn('[analytics]', err);
}

export const analytics = {
  identify: (userId, properties) => {
    if (!consentGranted) return;
    try { posthog?.identify(userId, properties); } catch (e) { warn(e); }
  },
  reset: () => {
    try { posthog?.reset(); } catch (e) { warn(e); }
  },
  track: (event, properties) => {
    if (!consentGranted) return;
    try { posthog?.capture(event, properties); } catch (e) { warn(e); }
  },
  optOut: () => {
    try { posthog?.opt_out_capturing(); } catch (e) { warn(e); }
  },
  optIn: () => {
    try { posthog?.opt_in_capturing(); } catch (e) { warn(e); }
  },
};
