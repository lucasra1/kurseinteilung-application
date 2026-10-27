// All Termin dates and times are wall-clock values in Europe/Vienna.

const viennaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vienna",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const germanDate = new Intl.DateTimeFormat("de-AT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const germanLongDate = new Intl.DateTimeFormat("de-AT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const germanMonth = new Intl.DateTimeFormat("de-AT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const germanWeekday = new Intl.DateTimeFormat("de-AT", {
  weekday: "short",
  timeZone: "UTC",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-07" as midnight UTC, so formatting never shifts the day. */
function utcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Today's date in Vienna as YYYY-MM-DD, independent of the server's time zone. */
export function todayInVienna(): string {
  return viennaDate.format(new Date());
}

export function isPastDate(date: string): boolean {
  return date < todayInVienna();
}

/** "2026-11-07" → "Sa., 07.11.2026" */
export function formatDate(date: string): string {
  return germanDate.format(utcDate(date));
}

/** "2026-11-07" → "Samstag, 7. November 2026" */
export function formatLongDate(date: string): string {
  return germanLongDate.format(utcDate(date));
}

/** "2026-11-07" → "November 2026" */
export function formatMonth(date: string): string {
  return germanMonth.format(utcDate(date));
}

/** "2026-11-07" → "Sa" */
export function formatWeekday(date: string): string {
  return germanWeekday.format(utcDate(date)).replace(".", "");
}

/** Days from today (Vienna) until `date`; negative for past dates. */
export function daysUntil(date: string): number {
  return Math.round(
    (utcDate(date).getTime() - utcDate(todayInVienna()).getTime()) / DAY_MS,
  );
}

/** "heute", "morgen", "in 12 Tagen" */
export function formatDaysUntil(date: string): string {
  const days = daysUntil(date);
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

/** "2026-11-07" → "2026-11-08" */
export function nextDay(date: string): string {
  return new Date(utcDate(date).getTime() + DAY_MS).toISOString().slice(0, 10);
}

/** "09:00:00" → "09:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** "09:00–17:00" */
export function formatTimeRange(t: {
  startTime: string;
  endTime: string;
}): string {
  return `${formatTime(t.startTime)}–${formatTime(t.endTime)}`;
}

/** "Sa., 07.11.2026, 09:00–17:00" */
export function formatTerminWhen(t: {
  date: string;
  startTime: string;
  endTime: string;
}): string {
  return `${formatDate(t.date)}, ${formatTime(t.startTime)}–${formatTime(t.endTime)}`;
}

/** Groups date-sorted items into months: [{ month: "November 2026", items }]. */
export function groupByMonth<T extends { date: string }>(
  items: T[],
): { month: string; items: T[] }[] {
  const groups: { month: string; items: T[] }[] = [];
  for (const item of items) {
    const month = formatMonth(item.date);
    const last = groups.at(-1);
    if (last?.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}
