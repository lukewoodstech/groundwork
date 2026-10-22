import { DAY_MS, RANGE_DAYS, TODAY } from "./area";

export type Period = "day" | "week" | "month" | "6m";

export const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: "day", label: "Day", days: 1 },
  { id: "week", label: "Week", days: 7 },
  { id: "month", label: "Month", days: 30 },
  { id: "6m", label: "6 Months", days: RANGE_DAYS + 1 },
];

/** A window of `period` length whose last day is `endDay` days before today. */
export type TimeRange = { period: Period; endDay: number };

export const periodDays = (p: Period) => PERIODS.find((x) => x.id === p)!.days;

// The demo clock sits in Provo (MDT, UTC-6) for the whole data range.
const TZ_OFFSET_MS = 6 * 3600_000;

/** Local midnight that starts the day `daysAgo` days before today. */
export const dayStartMs = (daysAgo: number) => TODAY.getTime() - 12 * 3600_000 - daysAgo * DAY_MS;

/** Which day (in days before today) an instant falls on. */
export const daysAgoOf = (ms: number) => Math.floor((dayStartMs(0) + DAY_MS - ms) / DAY_MS);

/**
 * Earliest end day for any period: the first day of the data. A window that
 * reaches further back than that is simply cut off at the data's start, which
 * is what lets replay grow a six-month window from nothing.
 */
export const maxEndDay = () => RANGE_DAYS;

export const clampRange = (r: TimeRange): TimeRange => ({
  period: r.period,
  endDay: Math.min(Math.max(r.endDay, 0), maxEndDay()),
});

/** [start, end) in ms, with the start cut off at the first day of data. */
export function rangeMs(r: TimeRange): [number, number] {
  const startDay = Math.min(r.endDay + periodDays(r.period) - 1, RANGE_DAYS);
  return [dayStartMs(startDay), dayStartMs(r.endDay) + DAY_MS];
}

/** Year, month (0-based) and day of month in Provo local time. */
export function localParts(ms: number) {
  const d = new Date(ms - TZ_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/** Days before today for a local calendar date. */
export const daysAgoOfDate = (year: number, month: number, day: number) =>
  Math.round((dayStartMs(0) - (Date.UTC(year, month, day) + TZ_OFFSET_MS)) / DAY_MS);

const fmt = (ms: number, opts: Intl.DateTimeFormatOptions) =>
  new Date(ms).toLocaleDateString("en-US", { ...opts, timeZone: "America/Denver" });

export const shortDate = (ms: number) => fmt(ms, { month: "short", day: "numeric" });

export function rangeLabel(r: TimeRange) {
  const [start, end] = rangeMs(r);
  const last = end - 1;
  switch (r.period) {
    case "day":
      return fmt(last, { weekday: "short", month: "short", day: "numeric" });
    case "week":
      return `Week of ${shortDate(start)}`;
    default:
      return `${shortDate(start)} – ${shortDate(last)}`;
  }
}
