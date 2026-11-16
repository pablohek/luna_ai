// Work with calendar dates in UTC to avoid DST/time-zone shifts.
export function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}
export function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return dateString(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseDate(b).getTime() - parseDate(a).getTime()) / 86400000,
  );
}
export function formatDate(
  iso: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...options,
  }).format(parseDate(iso));
}
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
export function shiftMonth(iso: string, delta: number): string {
  const d = parseDate(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return dateString(d);
}
