export type CategorySummary = {
  id: string;
  name: string;
  archived_at: string | null;
  limit_cents: number | null;
  spent_cents: number;
};

export type Overview = {
  categories: CategorySummary[];
  budgeted_cents: number;
  spent_cents: number;
  missing_limits: number;
};

export function validOverview(value: unknown): value is Overview {
  const cents = (amount: unknown) => Number.isSafeInteger(amount) && Number(amount) >= 0;
  if (!value || typeof value !== "object") return false;
  const overview = value as Partial<Overview>;
  return Array.isArray(overview.categories)
    && cents(overview.budgeted_cents) && cents(overview.spent_cents) && cents(overview.missing_limits)
    && overview.categories.every((category) => category && typeof category.id === "string"
      && typeof category.name === "string" && (category.archived_at === null || typeof category.archived_at === "string")
      && cents(category.spent_cents) && (category.limit_cents === null || cents(category.limit_cents)));
}

export function spendingLeft(overview: Overview): number {
  // Do not clamp category balances at zero or exclude unbudgeted spending.
  return overview.budgeted_cents - overview.spent_cents;
}

export function pieSlices(categories: CategorySummary[]) {
  const positive = categories.filter((category) => category.spent_cents > 0);
  const total = positive.reduce((sum, category) => sum + category.spent_cents, 0);
  let angle = -Math.PI / 2;
  return positive.map((category, index) => {
    const share = category.spent_cents / total;
    const start = angle;
    angle += share * 2 * Math.PI;
    const point = (value: number) => `${100 + 90 * Math.cos(value)},${100 + 90 * Math.sin(value)}`;
    return {
      ...category, share, color: `hsl(${(index * 137.508) % 360} 55% 42%)`,
      path: `M100,100 L${point(start)} A90,90 0 ${share > .5 ? 1 : 0},1 ${point(angle)} Z`,
    };
  });
}
