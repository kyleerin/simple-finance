# Simple Finance

A private, mobile-first monthly budget tracker. **Phase 2:** private access,
category management, monthly category limits, and account preferences.
Spending entry and reporting are not implemented yet.

## Stack

Next.js App Router, TypeScript, Supabase Auth/PostgreSQL, and Vercel.
Use Node.js 24 (also configured in `.nvmrc`).

## Access model

1. Every application request passes an HTTP Basic authentication gate. The
   username is `owner`; the password comes from `PRIVATE_ACCESS_PASSWORD`.
   This includes the login page, server actions, and static assets.
2. Supabase email/password sign-in verifies the owner, and the application
   checks the verified user's email against `ALLOWED_EMAIL` on protected pages.
3. PostgreSQL row-level security restricts profiles, categories, and monthly
   limits to their owner. Every budget action independently verifies sign-in
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
   **If phase 1 is already configured, apply only
   `202610280002_budget_setup.sql`.** Do not rerun the foundation migration.
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
- Currency cannot change while any monthly limits exist. This is enforced by
  the database as well as the UI's explanatory text. Timezone can be changed.
- Add categories and set limits for the selected calendar month.
- Blank amount + **Save limit** removes the limit (**Not set**); `0` is an
  explicit zero limit. Amounts must be non-negative with up to two decimals.
- **Copy previous month's limits** fills only missing limits for active
  categories. It never overwrites existing values, including zero.
- Expand **Manage [category]** to rename, move up/down, archive, or delete.
  Names are unique per owner, ignoring case, including archived categories.
- Archive categories to retain their limits. Archived categories can be restored.
  Deletion is allowed only for unused categories with no limits in any month.
- **Total planned** includes all limits for the selected month, including
  archived categories. It is not a spending balance. Unset active categories
  are flagged as an incomplete plan.
- There is no rollover, automatic month creation, or spending data in this phase.

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
3. Apply the phase-2 migration, then deploy `feature/phase-2-budget-setup` as a preview. Keep the PR unmerged while
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

Preview and production share data if they use the same Supabase project.
The phase-2 migration is additive and compatible with the phase-1 application,
but budget edits in the preview are real data. Use disposable categories/limits
or a separate Supabase project if you want isolated testing.

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
foreign keys, archiving, reordering, copy semantics, and currency protections.
They do not validate Supabase's live Auth/PostgREST integration or a real phone.
The Vercel checklist above is the manual integration acceptance test.

## Delivery workflow

Each phase gets a feature branch and a GitHub PR targeting the repository's
default branch (`main`). PR creation does not authorize merging.
See `docs/implementation-plan.md` for the remaining scope.
