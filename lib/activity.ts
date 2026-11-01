export const ACTIVITY_PAGE_SIZE = 50;

export function activityPage(value: unknown): number {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}

export function monthBounds(month: string) {
  // Inclusive end date also supports December 9999 without a five-digit
  // PostgREST date boundary. Callers validate the month first.
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${days}` };
}
