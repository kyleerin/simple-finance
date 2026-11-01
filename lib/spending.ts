import { CURRENCIES, MAX_CENTS, parseAmount } from "./budget";

export type SpendingDraft = {
  id: string;
  categoryId: string;
  amount: string;
  purchaseDate: string;
  note: string;
};

export type SpendingReceipt = {
  id: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  purchaseDate: string;
  note: string | null;
  currency: string;
};

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validPurchaseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || value < "1900-01-01" || value > "9999-12-31") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function today(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseSpending(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid spending entry.");
  const input = value as Record<string, unknown>;
  if (!isUuid(input.id)) throw new Error("Invalid submission ID. Reopen the spending form.");
  if (!isUuid(input.categoryId)) throw new Error("Choose a category.");
  if (typeof input.amount !== "string") throw new Error("Enter an amount.");
  const amountCents = parseAmount(input.amount);
  if (amountCents === 0) throw new Error("Spending must be greater than zero.");
  if (!validPurchaseDate(input.purchaseDate)) throw new Error("Choose a valid purchase date.");
  if (typeof input.note !== "string") throw new Error("Invalid note.");
  const note = input.note.trim();
  if ([...note].length > 500) throw new Error("Keep the note to 500 characters or fewer.");
  return {
    id: input.id.toLowerCase(), categoryId: input.categoryId.toLowerCase(),
    amountCents, purchaseDate: input.purchaseDate, note: note || null,
  };
}

export function matchesReceipt(input: ReturnType<typeof parseSpending>, receipt: SpendingReceipt) {
  return input.id === receipt.id && input.categoryId === receipt.categoryId
    && input.amountCents === receipt.amountCents && input.purchaseDate === receipt.purchaseDate
    && input.note === receipt.note;
}

export type SpendingSession = {
  draft: SpendingDraft;
  receipt: SpendingReceipt | null;
  changedRetry: boolean;
};

export function restoreSpendingSession(raw: string | null): SpendingSession | null {
  try {
    const stored = JSON.parse(raw ?? "null");
    const draft = stored?.draft;
    if (!isUuid(draft?.id) || !["amount", "categoryId", "purchaseDate", "note"]
      .every((key) => typeof draft[key] === "string")) return null;
    const receipt = stored.receipt;
    if (receipt && (!isUuid(receipt.id) || !isUuid(receipt.categoryId)
      || receipt.id !== draft.id || typeof receipt.categoryName !== "string"
      || !Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0 || receipt.amountCents > MAX_CENTS
      || !validPurchaseDate(receipt.purchaseDate) || !CURRENCIES.includes(receipt.currency)
      || !(receipt.note === null || typeof receipt.note === "string"))) return null;
    return { draft, receipt: receipt ?? null, changedRetry: stored.changedRetry === true };
  } catch {
    return null;
  }
}
