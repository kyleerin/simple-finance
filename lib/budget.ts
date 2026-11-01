export const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD"] as const;
export const MAX_CENTS = 99_999_999_999;

export function parseAmount(value: string): number {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a non-negative amount with at most two decimal places.");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents > MAX_CENTS) throw new Error("Amount is too large.");
  return cents;
}

export function amountInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
}

export function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    && value >= "1900-01" && value <= "9999-12";
}

export function shiftMonth(month: string, offset: number): string {
  if (!validMonth(month)) throw new Error("Choose a valid month.");
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export function categoryName(value: string): string {
  const name = value.trim();
  if (!name || [...name].length > 60) throw new Error("Use a category name between 1 and 60 characters.");
  return name;
}

export function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value.length > 0;
  } catch {
    return false;
  }
}

export type ActionState = { error?: string; success?: string };
