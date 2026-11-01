import Link from "next/link";
import { requireOwner } from "../lib/owner";
import { currentMonth, formatMoney } from "../lib/budget";
import { signOut } from "./actions";
import { spendingLeft, validOverview, type Overview } from "../lib/overview";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { supabase, user } = await requireOwner();
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("currency,time_zone").eq("id", user.id).single();
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
      <div className="home-actions">
        <Link className="primary-link" href="/spending/new">+ Add spending</Link>
        <Link className="nav-link" href={`/activity?month=${month}`}>View activity</Link>
      </div>
      <p><Link className="back-link" href={`/budget?month=${month}`}>Manage budget</Link></p>
    </section>
  );
}
