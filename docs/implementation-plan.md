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

Tested on Vercel and merged by the owner. Includes
restoring archived categories and deleting categories only when no monthly limits
reference them. Account preferences set currency/timezone; defaults USD/UTC.
Currency changes are blocked while any monthly limits exist.

Limits for archived categories remain visible and included in historical monthly
planned totals. Copying skips archived categories and never overwrites existing
target-month limits, including zero. A new month stays unset until explicitly
configured or copied.

## Phase 3 — Spending entry

Amount and category required; date defaults to today and is editable; note optional.
Positive purchase amounts only initially. Server validation and idempotent inserts.
Implemented on `feature/phase-3-spending-entry` for preview acceptance. A dedicated
mobile entry screen uses an authenticated JSON endpoint and database RPC to record
spending once per owner/submission ID. Retries return the original receipt even
if the payload changes or the category has since been archived. Changed retries
show an explicit warning instead of silently changing saved spending.

Dates default to today in the account timezone; purchase date determines the
month. Optional notes are trimmed and bounded to 500 characters. A confirmation
shows saved details, with an explicit "Add another purchase" to allocate a new
submission ID. Draft/receipt recovery uses per-user tab sessionStorage; there is
no offline queue or automatic submission. Input stays in memory if storage fails.

Currency and category-deletion guards now include spending, even without monthly
limits. Categories must be active for new spending; archiving preserves receipts.
Database privileges permit reading/inserting spending only; phase 4 must add
ownership policies/privileges and validation for editing/deleting.

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
default branch. Do not merge without explicit authorization. Phases 1 and 2
were accepted on Vercel and merged by the owner. Implement phase 3 only for now;
use its Vercel preview for owner acceptance before continuing.
