import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SpendingChart } from "../app/spending-chart";
import { pieSlices, spendingLeft, validOverview, type CategorySummary } from "../lib/overview";
import { activityPage, monthBounds } from "../lib/activity";

const category = (id: string, limit: number | null, spent: number, archived = false): CategorySummary => ({
  id, name: id, limit_cents: limit, spent_cents: spent, archived_at: archived ? "2026-01-01" : null,
});

test("Spending left subtracts every purchase, not just positive category balances", () => {
  const overview = {
    categories: [category("Food", 10000, 12000), category("Travel", 5000, 1000), category("Unbudgeted", null, 500), category("Archived", null, 700, true)],
    budgeted_cents: 15000, spent_cents: 14200, missing_limits: 2,
  };
  assert.equal(spendingLeft(overview), 800);
  assert.equal(validOverview(overview), true);
  assert.equal(validOverview({ ...overview, spent_cents: Number.MAX_SAFE_INTEGER + 1 }), false);
  assert.equal(spendingLeft({ ...overview, spent_cents: 17000 }), -2000);
});

test("pie includes actual spending, archived and unbudgeted, but not leftover limits", () => {
  const categories = [category("Food", 10000, 3000), category("Archived", null, 1000, true), category("Unspent", 20000, 0)];
  const slices = pieSlices(categories);
  assert.deepEqual(slices.map((slice) => [slice.name, slice.share]), [["Food", .75], ["Archived", .25]]);
  assert.ok(slices.every((slice) => !slice.path.includes("NaN")));
  const markup = renderToStaticMarkup(<SpendingChart categories={categories} currency="USD" />);
  assert.ok(markup.includes("Archived (archived)"));
  assert.ok(markup.includes("75.0%"));
  assert.ok(!markup.includes("Unspent"));
  assert.ok(markup.includes("<table"));
  const single = renderToStaticMarkup(<SpendingChart categories={[category("Only", 10000, 100)]} currency="USD" />);
  assert.ok(single.includes("<circle"));
  const empty = renderToStaticMarkup(<SpendingChart categories={[]} currency="USD" />);
  assert.ok(empty.includes("No spending recorded"));
  assert.ok(!empty.includes("<svg"));
});

test("activity pagination and inclusive month boundaries are stable", () => {
  assert.equal(activityPage("2"), 2);
  for (const value of [undefined, "0", "-1", "1.5", ["2"], "Infinity"]) assert.equal(activityPage(value), 1);
  assert.deepEqual(monthBounds("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
  assert.deepEqual(monthBounds("2026-02"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(monthBounds("9999-12"), { start: "9999-12-01", end: "9999-12-31" });
});
