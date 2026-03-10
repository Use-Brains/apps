function parseParts(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const trimmed = value.trim();

  const isoDate = new Date(trimmed);
  if (!Number.isNaN(isoDate.getTime()) && /(z|[+-]\d\d:?\d\d)$/i.test(trimmed)) {
    return null;
  }

  const ymd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ymd) {
    return {
      year: Number(ymd[1]),
      month: Number(ymd[2]),
      day: Number(ymd[3]),
      hour: Number(ymd[4] ?? 0),
      minute: Number(ymd[5] ?? 0),
      second: Number(ymd[6] ?? 0),
    };
  }

  const mdyOrDmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!mdyOrDmy) return null;

  const a = Number(mdyOrDmy[1]);
  const b = Number(mdyOrDmy[2]);
  const yRaw = Number(mdyOrDmy[3]);
  const year = yRaw < 100 ? 2000 + yRaw : yRaw;

  const month = a > 12 ? b : a;
  const day = a > 12 ? a : b;

  return {
    year,
    month,
    day,
    hour: Number(mdyOrDmy[4] ?? 0),
    minute: Number(mdyOrDmy[5] ?? 0),
    second: Number(mdyOrDmy[6] ?? 0),
  };
}

function parseOffsetMinutes(timeZoneName: string): number | null {
  const match = timeZoneName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });

  const parts = formatter.formatToParts(date);
  const tzName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
  return parseOffsetMinutes(tzName) ?? 0;
}

function toIsoInTimeZone(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}, timeZone: string): string | null {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );

  if (Number.isNaN(utcGuess.getTime())) return null;

  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, utcGuess);
  const shifted = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  return shifted.toISOString();
}

export function parseDateToIso(value: string, timeZone: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const strictIso = new Date(trimmed);
  if (!Number.isNaN(strictIso.getTime()) && /(z|[+-]\d\d:?\d\d)$/i.test(trimmed)) {
    return strictIso.toISOString();
  }

  const parts = parseParts(trimmed);
  if (!parts) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  }

  return toIsoInTimeZone(parts, timeZone);
}
