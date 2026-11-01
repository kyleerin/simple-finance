import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { changeSpending } from "../lib/manage-spending";
import { parseSpending } from "../lib/spending";
import { saveSpending } from "../lib/save-spending";

const owner = "11111111-1111-4111-8111-111111111111";
const input = parseSpending({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  amount: "12.34", purchaseDate: "2026-03-01", note: "",
});

test("edit/delete use ownership, live-row and expected-version filters", async () => {
  let calls = 0;
  const client = createClient("https://supabase.invalid", "test-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const query = new URL(String(url)).searchParams;
      assert.equal(init?.method, "PATCH");
      assert.equal(query.get("owner_id"), `eq.${owner}`);
      assert.equal(query.get("id"), `eq.${input.id}`);
      assert.equal(query.get("version"), "eq.2");
      assert.equal(query.get("deleted_at"), "is.null");
      const body = JSON.parse(String(init?.body));
      if (calls++ === 0) assert.deepEqual(body, { category_id: input.categoryId, amount_cents: 1234, purchase_date: input.purchaseDate, note: null });
      else assert.equal(typeof body.deleted_at, "string");
      return new Response(JSON.stringify([{ id: input.id, purchase_date: input.purchaseDate, version: 3 }]));
    } },
  });
  assert.equal((await changeSpending(client, owner, input.id, 2, input)).deleted, false);
  assert.equal((await changeSpending(client, owner, input.id, 2, null)).deleted, true);
});

test("stale versions and database errors never return mutation success", async () => {
  for (const response of [
    { body: [], status: 200, expected: 409 },
    { body: { code: "23514", message: "Category archived" }, status: 400, expected: 400 },
    { body: { code: "PGRST202", message: "Setup error" }, status: 400, expected: 503 },
  ]) {
    const client = createClient("https://supabase.invalid", "test-placeholder", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => new Response(JSON.stringify(response.body), { status: response.status }) },
    });
    const result = await changeSpending(client, owner, input.id, 2, input);
    assert.equal(result.status, response.expected);
    assert.equal(result.saved, undefined);
  }
});

test("a creation retry for a deleted purchase returns 410, never a fresh receipt", async () => {
  let calls = 0;
  const client = createClient("https://supabase.invalid", "test-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async () => {
      calls++;
      return new Response(JSON.stringify({
        id: input.id, category_id: input.categoryId, amount_cents: 1234, purchase_date: input.purchaseDate,
        note: null, deleted_at: "2026-03-02T00:00:00Z",
      }));
    } },
  });
  const result = await saveSpending(client, owner, input);
  assert.equal(result.status, 410);
  assert.equal(result.receipt, undefined);
  assert.equal(calls, 1);
});
