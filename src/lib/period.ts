/** Period ids keyed to Saturday 00:00 Europe/Amsterdam. */

const TZ = 'Europe/Amsterdam';

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=Sun … 6=Sat
};

function amsterdamParts(ms: number): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const map = Object.fromEntries(
    fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekdayMap[map.weekday ?? 'Mon'] ?? 1,
  };
}

function ymdKey(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

/** UTC timestamp of local Amsterdam midnight for the given calendar date. */
export function amsterdamMidnightUtc(
  year: number,
  month: number,
  day: number,
): number {
  const target = ymdKey(year, month, day);
  // Amsterdam is UTC+1/+2 → search around noon UTC that calendar day
  let t = Date.UTC(year, month - 1, day, 12, 0, 0) - 12 * 3600 * 1000;
  for (let i = 0; i < 48 * 3600; i += 60_000) {
    const p = amsterdamParts(t + i);
    const key = ymdKey(p.year, p.month, p.day);
    if (key === target && p.hour === 0 && p.minute === 0) {
      return t + i;
    }
  }
  // Fallback: binary search on day boundary
  let lo = Date.UTC(year, month - 1, day) - 48 * 3600 * 1000;
  let hi = Date.UTC(year, month - 1, day) + 48 * 3600 * 1000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const p = amsterdamParts(mid);
    const key = ymdKey(p.year, p.month, p.day);
    if (key < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Start of the current period: most recent Saturday 00:00 Amsterdam ≤ now. */
export function currentPeriodStartAmsterdam(now = Date.now()): number {
  const p = amsterdamParts(now);
  const daysSinceSaturday = (p.weekday + 1) % 7; // Sat→0, Sun→1, … Fri→6
  const start = addCalendarDays(p.year, p.month, p.day, -daysSinceSaturday);
  return amsterdamMidnightUtc(start.year, start.month, start.day);
}

export function currentPeriodId(now = Date.now()): string {
  const start = currentPeriodStartAmsterdam(now);
  const p = amsterdamParts(start);
  return `${p.year}-Sat-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function isPeriodStale(periodId: string, now = Date.now()): boolean {
  return periodId !== currentPeriodId(now);
}
