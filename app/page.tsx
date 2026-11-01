import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireOwner } from "../lib/owner";
import { currentMonth, formatMoney } from "../lib/budget";
import { today } from "../lib/spending";
import { signOut } from "./actions";
import { spendingLeft, validOverview, type Overview } from "../lib/overview";
import { SpendingForm } from "./spending/new/spending-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { supabase, user } = await requireOwner();
  const [{ data: profile, error: profileError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase.from("profiles").select("currency,time_zone").eq("id", user.id).single(),
    supabase.from("categories").select("id,name").eq("owner_id", user.id)
      .is("archived_at", null).order("display_order").order("id"),
  ]);
  if (profileError || !profile) {
    return (
      <section className="card">
        <h1>Database setup needs attention</h1>
        <p role="alert" className="error">Apply the phase-2 budget setup migration and confirm your account profile exists.</p>
        <form action={signOut}><button>Sign out</button></form>
      </section>
    );
  }
  const month = currentMonth(profile.time_zone);
  const { data, error: overviewError } = await supabase.rpc("budget_overview", { target_month: `${month}-01` });
  const overview: Overview | null = validOverview(data) ? data : null;
  const ready = !overviewError && overview !== null;
  const left = ready ? spendingLeft(overview) : 0;
  const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
  const formReady = !categoriesError;

  return (
    <section className="card budget screen">
      <p className="eyebrow">SIMPLE FINANCE · {label}</p>
      {ready ? (
        <div className="hero-balance">
          <p className="eyebrow">SPENDING LEFT · {profile.currency}</p>
          <h1 className={`total${left < 0 ? " error" : ""}`}>{formatMoney(left, profile.currency)}</h1>
          {left < 0 && <p className="error">Over budget for the month</p>}
        </div>
      ) : (
        <>
          <h1>Spending left</h1>
          <p role="alert" className="error">Could not load spending left. Check your connection and apply the phase-4 migration. Reload to retry.</p>
        </>
      )}
      <h2>Add spending</h2>
      {!formReady ? (
        <p role="alert" className="error">Could not load the form. Check your connection and apply the budget migrations, then reload.</p>
      ) : categories?.length ? (
        <SpendingForm
          userId={user.id}
          currency={profile.currency}
          date={today(profile.time_zone)}
          timeZone={profile.time_zone}
          categories={categories}
          submissionId={randomUUID()}
          embedded
        />
      ) : (
        <div className="action-stack">
          <p>Create or restore a category on your budget before recording spending.</p>
          <Link className="primary-link" href={`/budget?month=${month}`}>Go to budget</Link>
        </div>
      )}
      <div className="home-nav">
        <Link className="nav-link" href={`/activity?month=${month}`}>View activity</Link>
        <Link className="back-link" href={`/budget?month=${month}`}>Manage budget</Link>
      </div>
    </section>
  );
}
