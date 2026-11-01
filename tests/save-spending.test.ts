import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { saveSpending } from "../lib/save-spending";
import { parseSpending } from "../lib/spending";

const ownerId = "11111111-1111-4111-8111-111111111111";
const input = parseSpending({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  categoryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  amount: "12.34", purchaseDate: "2026-02-28", note: "",
});

test("save service requests singular RPC data and confirms saved rather than submitted details", async () => {
  const submissions: unknown[] = [];
  let missingProfile = false;
  const client = createClient("https://supabase.invalid", "test-publishable-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      assert.equal(new Headers(init?.headers).get("accept"), "application/vnd.pgrst.object+json");
      const path = new URL(String(url)).pathname;
      let body: unknown;
      if (path.endsWith("/rpc/record_spending")) {
        submissions.push(JSON.parse(String(init?.body)));
        body = { id: input.id, category_id: input.categoryId, amount_cents: 1234, purchase_date: input.purchaseDate, note: null };
      } else if (path.endsWith("/profiles")) {
        if (missingProfile) return new Response(JSON.stringify({ code: "PGRST116", message: "Missing profile" }), { status: 406 });
        body = { currency: "CAD" };
      } else {
        assert.equal(path, "/rest/v1/categories");
        assert.equal(new URL(String(url)).searchParams.get("owner_id"), `eq.${ownerId}`);
        body = { name: "Food" };
      }
      return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    } },
  });

  const first = await saveSpending(client, ownerId, input);
  assert.equal(first.receipt?.amountCents, 1234);
  assert.equal(first.receipt?.currency, "CAD");
  assert.equal(first.changedRetry, false);
  const changed = await saveSpending(client, ownerId, { ...input, amountCents: 9999 });
  assert.equal(changed.receipt?.amountCents, 1234);
  assert.equal(changed.changedRetry, true);

  missingProfile = true;
  const uncertain = await saveSpending(client, ownerId, input);
  assert.equal(uncertain.status, 503);
  assert.equal(uncertain.receipt, undefined);
  missingProfile = false;
  assert.equal((await saveSpending(client, ownerId, input)).receipt?.id, input.id);
  assert.equal(submissions.length, 4);
  for (const submission of submissions) {
    assert.equal((submission as { submission_id: string }).submission_id, input.id);
  }
});

test("failed RPC returns a retryable error without a false receipt", async () => {
  for (const code of ["23514", "PGRST202"]) {
    const client = createClient("https://supabase.invalid", "test-publishable-placeholder", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => new Response(JSON.stringify({ code, message: "fixture error" }), { status: 400 }) },
    });
    const result = await saveSpending(client, ownerId, input);
    assert.equal(result.status, code === "23514" ? 400 : 503);
    assert.equal(result.receipt, undefined);
  }
});
