export function getDeviceTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof timezone === 'string' && timezone.length > 0 ? timezone : 'UTC';
}

export function shouldSyncTimezone(currentTimezone?: string | null, deviceTimezone = getDeviceTimezone()) {
  return currentTimezone !== deviceTimezone;
}
