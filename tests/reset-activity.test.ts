import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { resetMonthActivity } from "../lib/reset-activity";

const owner = "11111111-1111-4111-8111-111111111111";

test("reset soft-deletes live purchases for the month with ownership filters", async () => {
  let calls = 0;
  const client = createClient("https://supabase.invalid", "test-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, init) => {
        const query = new URL(String(url)).searchParams;
        assert.equal(init?.method, "PATCH");
        assert.equal(query.get("owner_id"), `eq.${owner}`);
        assert.equal(query.get("deleted_at"), "is.null");
        assert.deepEqual(query.getAll("purchase_date"), ["gte.2026-03-01", "lte.2026-03-31"]);
        const body = JSON.parse(String(init?.body));
        assert.equal(typeof body.deleted_at, "string");
        calls++;
        if (calls === 1) {
          return new Response(JSON.stringify([{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }]));
        }
        return new Response(JSON.stringify([]));
      },
    },
  });
  const result = await resetMonthActivity(client, owner, "2026-03");
  assert.equal(result.removed, 1);
  assert.equal(result.error, undefined);
  assert.equal(calls, 2);
});

test("reset loops until PostgREST max-rows no longer truncates deletions", async () => {
  let calls = 0;
  const client = createClient("https://supabase.invalid", "test-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async () => {
        calls++;
        if (calls <= 2) {
          return new Response(JSON.stringify(
            Array.from({ length: 1000 }, (_, index) => ({ id: `batch-${calls}-${index}` })),
          ));
        }
        if (calls === 3) return new Response(JSON.stringify([{ id: "last" }]));
        return new Response(JSON.stringify([]));
      },
    },
  });
  const result = await resetMonthActivity(client, owner, "2026-02");
  assert.equal(result.removed, 2001);
  assert.equal(calls, 4);
});

test("invalid months and database errors never report a successful reset", async () => {
  const client = createClient("https://supabase.invalid", "test-placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async () => new Response(JSON.stringify({ message: "boom", code: "PGRST301" }), { status: 400 }),
    },
  });
  assert.equal((await resetMonthActivity(client, owner, "not-a-month")).status, 400);
  assert.equal((await resetMonthActivity(client, owner, "2026-13")).status, 400);
  const failed = await resetMonthActivity(client, owner, "2026-03");
  assert.equal(failed.status, 503);
  assert.equal(failed.removed, undefined);
});
