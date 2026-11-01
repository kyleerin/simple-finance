import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const groceries = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const transport = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreignCategory = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("budget migrations, constraints, RPCs and RLS on embedded PostgreSQL", async (t) => {
  const db = new PGlite();
  try {
    // Minimal Supabase identity shim. Execute the real migrations unchanged.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    for (const file of ["202610280001_foundation.sql", "202610280002_budget_setup.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into auth.users values ('${owner}'), ('${other}')`);
    const asUser = async (id: string) => {
      await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}'`);
    };
    await asUser(owner);

    await t.test("create account profile, preferences, and owned categories", async () => {
      const { rows } = await db.query("select id, currency, time_zone from public.profiles");
      assert.deepEqual(rows, [{ id: owner, currency: "USD", time_zone: "UTC" }]);
      await db.exec("update public.profiles set currency = 'CAD', time_zone = 'America/New_York'");
      await assert.rejects(db.exec("update public.profiles set time_zone = 'Not/A_Zone'"));
      await assert.rejects(db.exec("update public.profiles set currency = 'XYZ'"));
      await db.exec(`
        insert into public.categories (id, name) values
        ('${groceries}', 'Groceries'), ('${transport}', 'Transport');
      `);
      await assert.rejects(db.exec("insert into public.categories (name) values ('gROCERIES')"));
      await assert.rejects(db.exec("insert into public.categories (name) values ('  ')"));
      await asUser(other);
      await db.exec(`insert into public.categories (id, name) values ('${foreignCategory}', 'Other owner')`);
      await asUser(owner);
    });

    await t.test("RLS prevents reading or mutating another owner's records", async () => {
      assert.equal((await db.query("select * from public.categories")).rows.length, 2);
      assert.equal((await db.query(`update public.categories set name = 'Stolen' where id = '${foreignCategory}' returning id`)).rows.length, 0);
      await assert.rejects(db.exec(`insert into public.categories (owner_id, name) values ('${other}', 'Fake')`));
      await assert.rejects(db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${foreignCategory}', '2026-01-01', 100)`));
      await assert.rejects(db.exec(`select public.move_category('${foreignCategory}', 1)`));
      await assert.rejects(db.exec(`update public.profiles set id = '${other}'`));
    });

    await t.test("monthly limits enforce whole months, amounts, and uniqueness", async () => {
      await db.exec(`
        insert into public.monthly_limits (category_id, month, amount_cents) values
          ('${groceries}', '2026-01-01', 40000),
          ('${transport}', '2026-01-01', 0);
      `);
      await assert.rejects(db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2026-01-01', 50000)`));
      await assert.rejects(db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2026-02-02', 100)`));
      await assert.rejects(db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2026-02-01', -1)`));
      await assert.rejects(db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2026-02-01', 100000000000)`));
      await assert.rejects(db.exec("update public.profiles set currency = 'USD'"));
      await db.exec("update public.profiles set time_zone = 'UTC'");
    });

    await t.test("copy is atomic, repeatable, owner-scoped and never overwrites", async () => {
      await db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2026-02-01', 45000)`);
      assert.deepEqual((await db.query("select public.copy_previous_limits('2026-02-01') as count")).rows, [{ count: 1 }]);
      assert.deepEqual((await db.query("select public.copy_previous_limits('2026-02-01') as count")).rows, [{ count: 0 }]);
      assert.deepEqual((await db.query("select amount_cents::int from public.monthly_limits where month = '2026-02-01' order by amount_cents")).rows,
        [{ amount_cents: 0 }, { amount_cents: 45000 }]);
      await assert.rejects(db.exec("select public.copy_previous_limits('2026-02-02')"));
      await asUser(other);
      assert.equal((await db.query("select * from public.monthly_limits")).rows.length, 0);
      assert.equal((await db.query(`update public.monthly_limits set amount_cents = 1 where category_id = '${groceries}' returning id`)).rows.length, 0);
      assert.deepEqual((await db.query("select public.copy_previous_limits('2026-02-01') as count")).rows, [{ count: 0 }]);
      await asUser(owner);
    });

    await t.test("upsert changes only the selected month; copy crosses year boundaries", async () => {
      await db.exec(`
        insert into public.monthly_limits (category_id, month, amount_cents)
        values ('${groceries}', '2026-02-01', 46000)
        on conflict (category_id, month) do update set amount_cents = excluded.amount_cents;
      `);
      assert.deepEqual((await db.query(`select amount_cents::int from public.monthly_limits where category_id = '${groceries}' and month = '2026-01-01'`)).rows,
        [{ amount_cents: 40000 }]);
      await db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2025-12-01', 10000)`);
      // January already has values: copying December must not change them.
      assert.deepEqual((await db.query("select public.copy_previous_limits('2026-01-01') as count")).rows, [{ count: 0 }]);
      await db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${groceries}', '2026-12-01', 12345)`);
      assert.deepEqual((await db.query("select public.copy_previous_limits('2027-01-01') as count")).rows, [{ count: 1 }]);
      assert.deepEqual((await db.query("select amount_cents::int from public.monthly_limits where month = '2027-01-01'")).rows,
        [{ amount_cents: 12345 }]);
    });

    await t.test("reordering swaps neighbors and remains bounded", async () => {
      await db.exec(`select public.move_category('${groceries}', 1)`);
      assert.deepEqual((await db.query("select name from public.categories order by display_order, id")).rows,
        [{ name: "Transport" }, { name: "Groceries" }]);
      await db.exec(`select public.move_category('${groceries}', 1)`);
      await db.exec(`select public.move_category('${groceries}', -1)`);
      assert.deepEqual((await db.query("select name from public.categories order by display_order, id")).rows,
        [{ name: "Groceries" }, { name: "Transport" }]);
      await assert.rejects(db.exec(`select public.move_category('${groceries}', 0)`));
    });

    await t.test("archiving preserves history; copy skips archived categories", async () => {
      await db.exec(`update public.categories set archived_at = now(), name = 'Travel' where id = '${transport}'`);
      assert.equal((await db.query(`select * from public.monthly_limits where category_id = '${transport}'`)).rows.length, 2);
      await assert.rejects(db.exec(`delete from public.categories where id = '${transport}'`));
      await assert.rejects(db.exec(`insert into public.monthly_limits (category_id, month, amount_cents) values ('${transport}', '2026-03-01', 100)`));
      await assert.rejects(db.exec(`update public.monthly_limits set month = '2026-04-01' where category_id = '${transport}' and month = '2026-01-01'`));
      assert.deepEqual((await db.query("select public.copy_previous_limits('2026-03-01') as count")).rows, [{ count: 1 }]);
      await db.exec(`update public.categories set archived_at = null where id = '${transport}'`);
      assert.deepEqual((await db.query("select public.copy_previous_limits('2026-03-01') as count")).rows, [{ count: 1 }]);
      await db.exec(`insert into public.categories (name) values ('Unused')`);
      await db.exec("delete from public.categories where name = 'Unused'");
    });

    await t.test("clear a limit without touching other months; new months start unset", async () => {
      await db.exec(`delete from public.monthly_limits where category_id = '${groceries}' and month = '2026-02-01'`);
      assert.equal((await db.query(`select * from public.monthly_limits where category_id = '${groceries}' and month = '2026-01-01'`)).rows.length, 1);
      assert.equal((await db.query("select * from public.monthly_limits where month = '2026-04-01'")).rows.length, 0);
    });

    await t.test("anonymous requests cannot access tables or invoke mutations", async () => {
      await db.exec("reset role; set role anon; set request.jwt.claim.sub = ''");
      await assert.rejects(db.exec("select * from public.categories"));
      await assert.rejects(db.exec("select * from public.monthly_limits"));
      await assert.rejects(db.exec("select public.copy_previous_limits('2026-04-01')"));
      await assert.rejects(db.exec(`select public.move_category('${groceries}', 1)`));
    });
  } finally {
    await db.close();
  }
});
