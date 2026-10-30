# Simple Finance

A private, mobile-first monthly budget tracker. **Phase 1 only:** deployment,
two access layers, and a verified connection to the account profile table.
Budgeting and spending features are not implemented yet.

## Stack

Next.js App Router, TypeScript, Supabase Auth/PostgreSQL, and Vercel.
Use Node.js 24 (also configured in `.nvmrc`).

## Access model

1. Every application request passes an HTTP Basic authentication gate. The
   username is `owner`; the password comes from `PRIVATE_ACCESS_PASSWORD`.
   This includes the login page, server actions, and static assets.
2. Supabase email/password sign-in verifies the owner, and the application
   checks the verified user's email against `ALLOWED_EMAIL` on protected pages.
3. PostgreSQL row-level security restricts profile reads to their owner.

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
3. Execute `supabase/migrations/202610280001_foundation.sql` in the SQL editor
   (or apply it using your usual Supabase CLI migration workflow).
4. In Authentication > Users, create your user with an email and password and
   mark the email confirmed. The migration creates a profile automatically.
   Existing users are backfilled if the migration runs after account creation.
5. Obtain the project URL and publishable key from the project's API settings.
   Never put a service-role/secret key in the app.

`auth.users` is the identity table managed by Supabase. `public.profiles` is the
application user table, with its ID referencing `auth.users.id`. Preferences will
be added there when those features exist; we do not duplicate password storage.

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
3. Deploy `feature/phase-1-foundation` as a preview. Keep the PR unmerged while
   testing. Redeploy after changing environment variables.
4. Open the preview URL on your phone. Pass the outer gate and sign in.
5. Confirm **Account and database connected** appears. Sign out and confirm the
   home page redirects to sign-in.
6. In a fresh private browser session, confirm that the login page itself is
   inaccessible without the outer password. Incorrect account credentials should
   never reach the home screen.

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

Tests cover the gate and email-allowlist rules. Build and type checks do not
validate a live Supabase project, migrations, or a real phone. The Vercel checklist
above is the phase-1 integration acceptance test.

## Delivery workflow

Each phase gets a feature branch and a GitHub PR targeting the repository's
default branch (`main`). PR creation does not authorize merging.
See `docs/implementation-plan.md` for the remaining scope.
