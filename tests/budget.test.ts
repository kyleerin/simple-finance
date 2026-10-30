import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountInput, categoryName, currentMonth, formatMoney, parseAmount, shiftMonth, validMonth, validTimeZone,
} from "../lib/budget";

test("parse money as exact integer cents, including explicit zero", () => {
  for (const [input, expected] of [
    ["0", 0], ["0.00", 0], ["12", 1200], ["12.3", 1230], ["0.29", 29],
    [" 100.01 ", 10001], ["999999999.99", 99999999999],
  ] as const) assert.equal(parseAmount(input), expected);
  for (const input of ["", "-1", "1.234", "1e3", "Infinity", "NaN", "1,000", "$5", "1000000000"]) {
    assert.throws(() => parseAmount(input));
  }
  assert.equal(amountInput(29), "0.29");
  assert.equal(amountInput(1200), "12.00");
  assert.equal(formatMoney(1234, "USD"), "$12.34");
});

test("month navigation handles year boundaries and validates ranges", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2024-03", -1), "2024-02");
  for (const input of ["2026-00", "2026-13", "26-01", "2026-1", "1899-12", "10000-01", "2026-01-01"]) {
    assert.equal(validMonth(input), false);
  }
  assert.equal(validMonth("1900-01"), true);
  assert.equal(validMonth("9999-12"), true);
  assert.equal(validMonth(["2026-01", "2026-02"]), false);
  assert.equal(validMonth(undefined), false);
  assert.equal(validMonth(shiftMonth("9999-12", 1)), false);
  assert.equal(validMonth(shiftMonth("1900-01", -1)), false);
});

test("the account timezone determines the default month, not server timezone", () => {
  const boundary = new Date("2026-03-01T00:30:00Z");
  assert.equal(currentMonth("America/New_York", boundary), "2026-02");
  assert.equal(currentMonth("Pacific/Auckland", boundary), "2026-03");
  assert.equal(validTimeZone("America/New_York"), true);
  assert.equal(validTimeZone("not/a/timezone"), false);
});

test("category names are trimmed and bounded", () => {
  assert.equal(categoryName(" Groceries "), "Groceries");
  assert.throws(() => categoryName("   "));
  assert.throws(() => categoryName("x".repeat(61)));
});
