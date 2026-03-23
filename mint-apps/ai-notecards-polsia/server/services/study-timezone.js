const DEFAULT_TIMEZONE = 'UTC';

export function normalizeTimezone(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_TIMEZONE;
  }

  const timezone = value.trim();

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date('2026-01-01T00:00:00.000Z'));
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getUserTimezone(preferences) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return DEFAULT_TIMEZONE;
  }

  return normalizeTimezone(preferences.timezone);
}

export function toTimezoneDateKey(value, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function computeStreakMetrics(completedAtValues, timezone) {
  const uniqueDates = [
    ...new Set(completedAtValues.map((value) => toTimezoneDateKey(new Date(value), timezone))),
  ].sort();

  if (uniqueDates.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_study_date: null,
    };
  }

  let longest = 1;
  let currentRun = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00.000Z`);
    const current = new Date(`${uniqueDates[index]}T00:00:00.000Z`);
    const dayDelta = (current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000);

    if (dayDelta === 1) {
      currentRun += 1;
      longest = Math.max(longest, currentRun);
      continue;
    }

    currentRun = 1;
  }

  let trailingRun = 1;
  for (let index = uniqueDates.length - 1; index > 0; index -= 1) {
    const current = new Date(`${uniqueDates[index]}T00:00:00.000Z`);
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00.000Z`);
    const dayDelta = (current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000);

    if (dayDelta === 1) {
      trailingRun += 1;
      continue;
    }

    break;
  }

  return {
    current_streak: trailingRun,
    longest_streak: longest,
    last_study_date: uniqueDates[uniqueDates.length - 1],
  };
}

export function getCurrentDateKey(now, timezone) {
  return toTimezoneDateKey(now, timezone);
}
