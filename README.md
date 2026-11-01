# Simple Finance

A private, mobile-first monthly budget tracker. **Phase 3:** private access,
category management, monthly category limits, account preferences, and manual
spending entry. Spending totals, charts, and activity editing arrive in phase 4.

## Stack

Next.js App Router, TypeScript, Supabase Auth/PostgreSQL, and Vercel.
Use Node.js 24 (also configured in `.nvmrc`).

## Access model

1. Every application request passes an HTTP Basic authentication gate. The
   username is `owner`; the password comes from `PRIVATE_ACCESS_PASSWORD`.
   This includes the login page, server actions, and static assets.
2. Supabase email/password sign-in verifies the owner, and the application
   checks the verified user's email against `ALLOWED_EMAIL` on protected pages.
3. PostgreSQL row-level security restricts profiles, categories, monthly
   limits, and spending to their owner. Every financial write independently verifies sign-in
   and the owner email allowlist.

There is no registration page. **Disable public signups in Supabase** and
manually create only your account. The email allowlist is a server-side app
restriction, not a substitute for disabling Supabase signups.

Use different, strong passwords for the outer gate and Supabase account. Basic
authentication requires HTTPS outside localhost; Vercel supplies HTTPS. Browsers
cache the outer credentials, so the app's Sign out button signs out of Supabase,
not the outer gate. Close the private browsing session to discard gate credentials.
The gate is a simple private-beta barrier, not MFA or network isolation. Supabase
handles sign-in rate limiting; the outer password gate has no built-in rate limit.
Use Vercel firewall rules/deployment protection for additional perimeter controls.

## Set up Supabase

1. Create a Supabase project.
2. In Authentication settings, disable **Allow new users to sign up**.
3. Apply the SQL files in `supabase/migrations/` in filename order, once each,
   in the SQL editor (or use your usual Supabase CLI migration workflow).
   **If phase 2 is already configured, apply only
   `202610280003_spending_entry.sql`.** Do not rerun earlier migrations.
4. In Authentication > Users, create your user with an email and password and
   mark the email confirmed. The migration creates a profile automatically.
   Existing users are backfilled if the migration runs after account creation.
5. Obtain the project URL and publishable key from the project's API settings.
   Never put a service-role/secret key in the app.

`auth.users` is the identity table managed by Supabase. `public.profiles` is the
application user table, with its ID referencing `auth.users.id`. It stores
currency and timezone preferences; we do not duplicate password storage.

## Budget setup

- Open **Account preferences** first. Defaults are USD and UTC; supported
  currencies are USD, CAD, EUR, GBP, AUD, and NZD (all two-decimal currencies).
  Use an IANA timezone such as `America/New_York`.
- Currency cannot change while any monthly limits or spending exist. This is enforced by
  the database as well as the UI's explanatory text. Timezone can be changed.
- Add categories and set limits for the selected calendar month.
- Blank amount + **Save limit** removes the limit (**Not set**); `0` is an
  explicit zero limit. Amounts must be non-negative with up to two decimals.
- **Copy previous month's limits** fills only missing limits for active
  categories. It never overwrites existing values, including zero.
- Expand **Manage [category]** to rename, move up/down, archive, or delete.
  Names are unique per owner, ignoring case, including archived categories.
- Archive categories to retain their limits. Archived categories can be restored.
  Deletion is allowed only for unused categories with no limits or spending.
- **Total planned** includes all limits for the selected month, including
  archived categories. It is not a spending balance. Unset active categories
  are flagged as an incomplete plan.
- There is no rollover or automatic month creation.

## Record spending

- Tap **Add spending** on the budget, or open `/spending/new`.
- Enter a positive amount and tap an active category. No monthly limit is
  required to record a purchase.
- Purchase date defaults to today in your account timezone, even when you
  navigated to a different budget month. You can change the date.
- Merchant/note is optional, under **Add a note**, with a 500-character limit.
- Wait for **Spending saved** and the server-confirmed amount, category, and
  purchase date. This date, not the creation timestamp, determines the month.
- Tap **Add another purchase** to start a fresh entry with a new submission ID.
  The last confirmation stays available when returning to the form in this tab.
- If saving fails or confirmation is lost, input and submission ID are retained.
  Retry the same entry: the database returns the original receipt, never another
  purchase. If you edited an already-saved retry, the original is shown with a
  warning; it is not overwritten.
- Drafts and the last confirmation are stored in **sessionStorage**, per user and
  browser tab, so reloads can safely retry. This stores financial details on that
  device until the tab session ends or browser storage is cleared. If storage
  is unavailable, input/retry protection lasts only while the form stays open.
  This is recovery, not offline synchronization: nothing is queued or sent
  automatically.
- No spending edits/deletes or history screen yet. **Total planned** remains a
  budget total, not a remaining balance. Full reporting is phase 4.

## Run locally

```sh
npm ci
cp .env.example .env.local
# Fill in .env.local privately, then:
npm run dev
```

Set all four variables:

| Variable | Value |
| --- | --- |
| `PRIVATE_ACCESS_PASSWORD` | A long, unique outer-gate password |
| `ALLOWED_EMAIL` | Your Supabase account email |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

Open http://localhost:3000. Enter `owner` and the outer password in the browser's
authentication prompt, then sign in using your Supabase email/password.
Missing configuration fails closed; it never makes the app public.

## Test on Vercel

1. Import `kyleerin/simple-finance` into Vercel with the Next.js framework preset.
2. Set Node.js to **24.x** and add the four environment variables above to the
   **Preview** environment (and Production when deploying main).
3. Apply the phase-3 migration, then deploy `feature/phase-3-spending-entry` as a preview. Keep the PR unmerged while
   testing. Redeploy after changing environment variables.
4. Open the preview URL on your phone. Pass the outer gate and sign in.
5. Confirm **Your monthly budget** appears. Set currency/timezone in account
   preferences before entering limits.
6. In a fresh private browser session, confirm that the login page itself is
   inaccessible without the outer password. Incorrect account credentials should
   never reach the home screen.

### Phase-2 acceptance checklist

1. Add Groceries and Transport. Rename a category and move it up/down; reload
   and verify the changes persist. A duplicate name should show an inline error.
2. Set Groceries to `400` and Transport to `0`. Verify the total is `400.00`
   in your currency and zero is displayed as a saved limit, not **Not set**.
3. Navigate to the next month. Both limits should be **Not set**.
4. Set Groceries to `450` in that month, then copy the previous month's limits.
   Groceries stays `450`; Transport gets zero. Repeat copying: zero are copied.
5. Change next month's Groceries limit; verify the earlier month is unchanged.
6. Clear a limit with a blank input and save; it returns to **Not set**.
7. Archive a category with limits. Its historical limits still appear under
   **Archived categories**, and copying excludes it. Restore it and verify its
   limits remain. Deleting it should fail with a message to archive instead.
8. Add a disposable category with no limits and delete it.
9. Enter a negative amount or three decimal places. Verify an inline error and
   that your input is retained. Check missing-limit and empty-category states.
10. Try changing currency after saving limits: it must be rejected. Timezone
    changes should save successfully. Sign out and verify home requires sign-in.

### Phase-3 acceptance checklist

1. With an active category, tap **Add spending**. Confirm the date matches your
   account timezone, not the selected budget month.
2. Save `12.34` with a category and optional note. Verify the confirmation
   displays the exact amount/date/note. In Supabase's `spending_entries` table,
   verify `amount_cents = 1234` and the selected `purchase_date`.
3. Double-tap Save and confirm there is only one row. Reload/return to the form
   in the same tab: the last receipt should still be shown.
4. Tap **Add another purchase** and record the same details again intentionally:
   this must create a separate row with a new ID.
5. Try zero, a negative amount, three decimal places, and no category. Verify
   errors and that input is not discarded.
6. Use browser network tools to interrupt a save or temporarily go offline.
   Confirm there is no false success. Restore connectivity and retry; there
   must be one row for that submission ID, even if the first save reached the
   server. A reload in the same tab should restore the unfinished draft.
7. In another tab, archive the selected category before saving. The request
   must fail; keep the amount/note and select another active category to retry.
8. Backdate a purchase to the previous month. Verify the confirmation links to
   that month and the database preserves that date. Totals are not yet shown.
9. With spending in a category that has no monthly limits, try deleting it:
   deletion must fail. Archiving must retain the spending. Currency changes
   must be rejected even if there are no limits anywhere.
10. Sign out in another tab before saving. Verify sign-in is required and input
    is kept. Sign back in in that other tab, then retry the original form.
11. Check the no-active-category state using a disposable account/project with
    no active categories. Do not archive your real categories just for this test.

Preview and production share data if they use the same Supabase project.
The phase-3 migration is additive and compatible with the phase-2 application,
but preview spending is real data and has no delete UI yet. Use a separate
Supabase project for isolated testing; do not record fake spending in your real
budget unless you intend to remove those test records through Supabase.

Email/password sign-in does not need an OAuth callback or email redirect URL.
Do not put credentials into GitHub comments, screenshots, or committed files.
Supabase is a separate public API: keep signups disabled and RLS enabled even
though the Vercel application has an outer gate.

## Checks

```sh
npm test
npm run build
npm run typecheck
```

Tests cover access rules, amount/month/name validation, timezone boundaries,
and real migration SQL on embedded PostgreSQL (PGlite). Database tests use a
minimal Supabase identity shim to check RLS under separate owner/anonymous roles,
foreign keys, archiving, reordering, copy semantics, currency protections, and
spending idempotency/ownership. The phase-3 SQL is also applied to a populated
phase-2 database. Unit tests cover spending validation, receipt matching, and
tab-draft restoration. Service tests use the real Supabase SDK with a mocked
PostgREST transport to check singular RPC responses, changed retries, and
unconfirmed-save recovery. Concurrent retries are serialized by a database advisory
lock; embedded tests exercise sequential retries, not multi-connection concurrency.
They do not validate Supabase's live Auth/PostgREST integration or a real phone.
The Vercel checklist above is the manual integration acceptance test.

## Delivery workflow

Each phase gets a feature branch and a GitHub PR targeting the repository's
default branch (`main`). PR creation does not authorize merging.
See `docs/implementation-plan.md` for the remaining scope.
