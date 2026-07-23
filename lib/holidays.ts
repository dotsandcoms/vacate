// South African public holidays + working-day arithmetic.
// Public Holidays Act: when a holiday falls on a Sunday, the following
// Monday is a public holiday.

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const holidayCache = new Map<number, Set<string>>();

/** All SA public holidays for a year (ISO date strings), incl. Sunday-observance Mondays. */
export function saHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const fixed: [number, number][] = [
    [0, 1], // New Year's Day
    [2, 21], // Human Rights Day
    [3, 27], // Freedom Day
    [4, 1], // Workers' Day
    [5, 16], // Youth Day
    [7, 9], // National Women's Day
    [8, 24], // Heritage Day
    [11, 16], // Day of Reconciliation
    [11, 25], // Christmas Day
    [11, 26], // Day of Goodwill
  ];

  const dates: Date[] = fixed.map(([m, d]) => new Date(Date.UTC(year, m, d)));

  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(easter.getUTCDate() - 2);
  const familyDay = new Date(easter);
  familyDay.setUTCDate(easter.getUTCDate() + 1);
  dates.push(goodFriday, familyDay);

  const set = new Set<string>();
  for (const d of dates) {
    set.add(iso(d));
    if (d.getUTCDay() === 0) {
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() + 1);
      set.add(iso(monday));
    }
  }
  holidayCache.set(year, set);
  return set;
}

export function isWorkingDay(isoDate: string): boolean {
  const d = new Date(isoDate + "T00:00:00Z");
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !saHolidays(d.getUTCFullYear()).has(isoDate);
}

/** Working days between two ISO dates inclusive — excludes weekends and SA public holidays. */
export function workingDays(startIso: string, endIso: string): number {
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  if (isNaN(+start) || isNaN(+end) || end < start) return 0;
  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isWorkingDay(iso(d))) count++;
  }
  return count;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Fri 24 Jul" — human date, SA style. Adds year only if not the current year. */
export function humanDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  if (isNaN(+d)) return isoDate;
  const base = `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear()
    ? base
    : `${base} ${d.getUTCFullYear()}`;
}

/** "21–24 Jul" or "28 Jul – 2 Aug" — compact range. */
export function humanRange(startIso: string, endIso: string): string {
  const s = new Date(startIso + "T00:00:00Z");
  const e = new Date(endIso + "T00:00:00Z");
  if (isNaN(+s) || isNaN(+e)) return `${startIso} – ${endIso}`;
  if (startIso === endIso) return humanDate(startIso);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear())
    return `${s.getUTCDate()}–${e.getUTCDate()} ${MONTH_NAMES[e.getUTCMonth()]}`;
  return `${s.getUTCDate()} ${MONTH_NAMES[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTH_NAMES[e.getUTCMonth()]}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}
