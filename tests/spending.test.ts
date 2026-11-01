import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesReceipt, parseSpending, restoreSpendingSession, today, validPurchaseDate } from "../lib/spending";

const draft = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  categoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  amount: "12.34", purchaseDate: "2026-02-28", note: " Lunch ",
};

test("spending validates positive exact cents and normalizes optional notes", () => {
  assert.deepEqual(parseSpending(draft), {
    id: draft.id, categoryId: draft.categoryId, amountCents: 1234,
    purchaseDate: "2026-02-28", note: "Lunch",
  });
  assert.equal(parseSpending({ ...draft, note: " " }).note, null);
  for (const amount of ["0", "-1", "1.234", "", "1e3"]) {
    assert.throws(() => parseSpending({ ...draft, amount }));
  }
  assert.throws(() => parseSpending({ ...draft, categoryId: "" }));
  assert.throws(() => parseSpending({ ...draft, id: "invalid" }));
  assert.throws(() => parseSpending({ ...draft, note: "x".repeat(501) }));
  assert.throws(() => parseSpending(null));
});

test("purchase dates are real calendar dates and today uses account timezone", () => {
  for (const value of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-1-01", "1899-12-31", "10000-01-01"]) {
    assert.equal(validPurchaseDate(value), false);
    assert.throws(() => parseSpending({ ...draft, purchaseDate: value }));
  }
  assert.equal(validPurchaseDate("2024-02-29"), true);
  assert.equal(validPurchaseDate("9999-12-31"), true);
  const boundary = new Date("2026-03-01T00:30:00Z");
  assert.equal(today("America/New_York", boundary), "2026-02-28");
  assert.equal(today("Pacific/Auckland", boundary), "2026-03-01");
});

test("changed retries are identified without overwriting the original receipt", () => {
  const input = parseSpending(draft);
  const receipt = {
    ...input, categoryName: "Food", currency: "USD",
  };
  assert.equal(matchesReceipt(input, receipt), true);
  for (const change of [
    { amountCents: 999 }, { categoryId: draft.id }, { purchaseDate: "2026-03-01" }, { note: null },
  ]) assert.equal(matchesReceipt(input, { ...receipt, ...change }), false);
});

test("tab draft and confirmed receipt survive reload; corrupt storage is ignored", () => {
  const session = { draft: { ...draft, amount: "" }, receipt: null, changedRetry: false };
  assert.deepEqual(restoreSpendingSession(JSON.stringify(session)), session);
  const receipt = { ...parseSpending(draft), categoryName: "Food", currency: "USD" };
  assert.deepEqual(restoreSpendingSession(JSON.stringify({ draft, receipt, changedRetry: true })),
    { draft, receipt, changedRetry: true });
  for (const raw of [null, "{bad", "{}", JSON.stringify({ draft: { id: "bad" } }),
    JSON.stringify({ draft, receipt: { ...receipt, amountCents: -1 } }),
    JSON.stringify({ draft, receipt: { ...receipt, id: draft.categoryId } }),
  ]) assert.equal(restoreSpendingSession(raw), null);
});
