# Implementation plan

## Agreed product rules

- Personal use only; online-only, mobile-first web app.
- Monthly category limits; calendar months; no rollover.
- Copying limits copies planned amounts only, not spending or balances.
- Manual spending entry, editable purchase date, optional note.
- Amounts stored as integer minor units in one configured currency.
- Purchase date determines the month; timezone defines "today."
- Remaining amounts below zero are red and have an explicit minus sign/text,
  so color is not the only indication of overspending.
- Confirm saves only after server acknowledgement, retain failed form inputs,
  and deduplicate retries with a stable submission ID.
- No bank syncing, household sharing, offline support, or native mobile app.

## Phase 1 — Private foundation

Next.js/TypeScript app, Vercel setup instructions, outer access gate, owner-only
Supabase sign-in, profile migration/RLS, and authenticated database status screen.
No financial tables or entry screens in this phase.

Acceptance: owner can sign in on a phone through a Vercel preview and see the
database connection succeed. Fresh sessions cannot see the app without passing
the outer gate. Non-owner identities cannot access the protected home screen.

## Phase 2 — Budget setup

Category CRUD/reordering/archiving and per-category monthly limits. Enforce
ownership and unique category/month limits in PostgreSQL. No rollover. Offer
"Copy previous month's limits" without overwriting existing limits silently.
Missing limits remain explicitly "Not set."

## Phase 3 — Spending entry

Amount and category required; date defaults to today and is editable; note optional.
Positive purchase amounts only initially. Server validation and idempotent inserts.

## Phase 4 — Overview and activity

Monthly category limit/spent/remaining overview; editable/deletable activity.
Negative remaining amounts display red with an explicit negative value.

Add a pie chart showing actual spending by category for the selected month,
with an accessible text breakdown and an empty state when no spending exists.
Do not mix unspent budget into the spending pie chart.

Add a separate **Spending left** summary:

    total configured monthly limits − all spending in the selected month

Overspending reduces the total even when other categories have money left; do not
sum only positive category balances. Include spending in categories without a
limit, and label the total as incomplete if any active categories lack limits.

## Phase 5 — Release hardening

Failure-state/accessibility checks, real-phone workflows, CSV export,
backup/restore verification, and end-to-end security and budget tests.

## Branch and review policy

For each phase, create a separate feature branch and open a GitHub PR to the
default branch. Do not merge without explicit authorization. Implement phase 1
only for now; use its Vercel preview for owner acceptance before continuing.
