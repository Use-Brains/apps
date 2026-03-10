export type JournalViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface JournalPeriodRange {
  key: string;
  dateFrom: string;
  dateTo: string;
  rangeLabel: string;
}

export interface JournalPeriodOption extends JournalPeriodRange {
  primaryLabel: string;
  secondaryLabel?: string;
  anchorDate: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function atStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function atEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function getIsoWeekStart(date: Date): Date {
  const start = atStartOfDay(date);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(start, diffToMonday);
}

function getIsoWeekInfo(date: Date): { week: number; year: number } {
  const target = atStartOfDay(date);
  const dayNumber = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);

  const isoYear = target.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNumber + 3);

  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { week, year: isoYear };
}

function formatDailyKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonthlyKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function formatRangeLabel(
  viewMode: JournalViewMode,
  anchorDate: Date,
  weekInfo: { week: number; year: number }
): string {
  if (viewMode === 'daily') {
    return anchorDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (viewMode === 'weekly') {
    const weekStart = getIsoWeekStart(anchorDate);
    const weekEnd = atEndOfDay(addDays(weekStart, 6));
    const startLabel = weekStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endLabel = weekEnd.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `Week ${weekInfo.week} • ${startLabel} - ${endLabel}`;
  }

  if (viewMode === 'monthly') {
    return anchorDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  return String(anchorDate.getFullYear());
}

export function getJournalPeriodKey(viewMode: JournalViewMode, anchorDate: Date): string {
  if (viewMode === 'daily') return formatDailyKey(anchorDate);
  if (viewMode === 'weekly') {
    const { week, year } = getIsoWeekInfo(anchorDate);
    return `${year}-W${pad2(week)}`;
  }
  if (viewMode === 'monthly') return formatMonthlyKey(anchorDate);
  return String(anchorDate.getFullYear());
}

export function getJournalPeriodRange(viewMode: JournalViewMode, anchorDate: Date): JournalPeriodRange {
  let start: Date;
  let end: Date;

  if (viewMode === 'daily') {
    start = atStartOfDay(anchorDate);
    end = atEndOfDay(anchorDate);
  } else if (viewMode === 'weekly') {
    start = getIsoWeekStart(anchorDate);
    end = atEndOfDay(addDays(start, 6));
  } else if (viewMode === 'monthly') {
    start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(anchorDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(anchorDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  const weekInfo = getIsoWeekInfo(anchorDate);

  return {
    key: getJournalPeriodKey(viewMode, anchorDate),
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
    rangeLabel: formatRangeLabel(viewMode, anchorDate, weekInfo),
  };
}

function buildOption(viewMode: JournalViewMode, anchorDate: Date): JournalPeriodOption {
  const weekInfo = getIsoWeekInfo(anchorDate);
  const range = getJournalPeriodRange(viewMode, anchorDate);

  if (viewMode === 'daily') {
    return {
      ...range,
      anchorDate,
      primaryLabel: anchorDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      secondaryLabel: anchorDate.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  }

  if (viewMode === 'weekly') {
    return {
      ...range,
      anchorDate,
      primaryLabel: `W${pad2(weekInfo.week)}`,
      secondaryLabel: String(weekInfo.year),
    };
  }

  if (viewMode === 'monthly') {
    return {
      ...range,
      anchorDate,
      primaryLabel: anchorDate.toLocaleDateString('en-US', { month: 'short' }),
      secondaryLabel: String(anchorDate.getFullYear()),
    };
  }

  return {
    ...range,
    anchorDate,
    primaryLabel: String(anchorDate.getFullYear()),
  };
}

export function buildJournalPeriodOptions(
  viewMode: JournalViewMode,
  anchorDate: Date
): JournalPeriodOption[] {
  if (viewMode === 'daily') {
    const center = atStartOfDay(anchorDate);
    return Array.from({ length: 181 }, (_, index) =>
      buildOption(viewMode, addDays(center, index - 90))
    );
  }

  if (viewMode === 'weekly') {
    const center = getIsoWeekStart(anchorDate);
    return Array.from({ length: 261 }, (_, index) =>
      buildOption(viewMode, addWeeks(center, index - 130))
    );
  }

  if (viewMode === 'monthly') {
    return Array.from({ length: 121 }, (_, index) =>
      buildOption(
        viewMode,
        new Date(anchorDate.getFullYear(), anchorDate.getMonth() + (index - 60), 1, 12, 0, 0, 0)
      )
    );
  }

  return Array.from({ length: 61 }, (_, index) =>
    buildOption(viewMode, new Date(anchorDate.getFullYear() + (index - 30), 0, 1, 12, 0, 0, 0))
  );
}
