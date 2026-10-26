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

/** Today's date in Vienna as YYYY-MM-DD, independent of the server's time zone. */
export function todayInVienna(): string {
  return viennaDate.format(new Date());
}

export function isPastDate(date: string): boolean {
  return date < todayInVienna();
}

/** "2026-11-07" → "Sa., 07.11.2026" */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return germanDate.format(new Date(Date.UTC(year, month - 1, day)));
}

/** "09:00:00" → "09:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** "Sa., 07.11.2026, 09:00–17:00" */
export function formatTerminWhen(t: {
  date: string;
  startTime: string;
  endTime: string;
}): string {
  return `${formatDate(t.date)}, ${formatTime(t.startTime)}–${formatTime(t.endTime)}`;
}
