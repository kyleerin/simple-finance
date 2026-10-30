import Link from "next/link";
import { requireOwner } from "../lib/owner";
import { amountInput, CURRENCIES, currentMonth, formatMoney, shiftMonth, validMonth } from "../lib/budget";
import { signOut } from "./actions";
import { addCategory, changeCategory, copyLimits, saveLimit, savePreferences } from "./budget-actions";
import { ActionForm } from "./action-form";

export const dynamic = "force-dynamic";

type Category = { id: string; name: string; archived_at: string | null };
type Limit = { category_id: string; amount_cents: number };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
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
  const requested = (await searchParams).month;
  const month = requested && validMonth(requested) ? requested : currentMonth(profile.time_zone);
  const [{ data: categories, error: categoryError }, { data: limits, error: limitError }] = await Promise.all([
    supabase.from("categories").select("id,name,archived_at").eq("owner_id", user.id)
      .order("display_order").order("id"),
    supabase.from("monthly_limits").select("category_id,amount_cents").eq("owner_id", user.id).eq("month", `${month}-01`),
  ]);
  const ready = !categoryError && !limitError;
  const all = (categories ?? []) as Category[];
  const active = all.filter((category) => !category.archived_at);
  const archived = all.filter((category) => category.archived_at);
  const amounts = new Map((limits ?? []).map((limit: Limit) => [limit.category_id, Number(limit.amount_cents)]));
  const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0);
  const missing = active.filter((category) => !amounts.has(category.id)).length;
  const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));

  function categoryControls(category: Category, index: number) {
    return (
      <details className="category-controls">
        <summary>Manage {category.name}</summary>
        <ActionForm action={changeCategory} label="Rename" secondary
          key={`${category.id}-${category.name}`}
          hidden={{ id: category.id, operation: "rename" }}
          fields={[{ name: "name", label: "Category name", value: category.name, required: true, maxLength: 60 }]} />
        <div className="button-row">
          {!category.archived_at && index > 0 && (
            <ActionForm action={changeCategory} label={`Move ${category.name} up`} secondary hidden={{ id: category.id, operation: "up" }} />
          )}
          {!category.archived_at && index < active.length - 1 && (
            <ActionForm action={changeCategory} label={`Move ${category.name} down`} secondary hidden={{ id: category.id, operation: "down" }} />
          )}
          <ActionForm action={changeCategory} label={category.archived_at ? "Restore category" : "Archive category"}
            secondary hidden={{ id: category.id, operation: category.archived_at ? "restore" : "archive" }}
            confirm={category.archived_at ? undefined : "Archive this category? All historical limits will be kept."} />
          <ActionForm action={changeCategory} label="Delete unused category" secondary
            hidden={{ id: category.id, operation: "delete" }}
            confirm="Permanently delete this category? This is only allowed if it has no monthly limits." />
        </div>
      </details>
    );
  }

  return (
    <section className="card budget">
      <header>
        <p className="eyebrow">SIMPLE FINANCE · {profile.currency}</p>
        <h1>Your monthly budget</h1>
        <p className="muted">Set your category limits. Each month stands alone—no rollover.</p>
      </header>
      <nav className="month-nav" aria-label="Budget month">
        {validMonth(shiftMonth(month, -1)) ? <Link href={`/?month=${shiftMonth(month, -1)}`}>← Previous</Link> : <span />}
        <h2>{label}</h2>
        {validMonth(shiftMonth(month, 1)) ? <Link href={`/?month=${shiftMonth(month, 1)}`}>Next →</Link> : <span />}
      </nav>
      <form method="get" className="month-picker">
        <label>Choose month<input type="month" name="month" min="1900-01" max="9999-12" defaultValue={month} required /></label>
        <button className="secondary">Go</button>
      </form>
      {requested && !validMonth(requested) && <p role="alert" className="error">Invalid month. Showing your current month instead.</p>}
      {!ready ? (
        <p role="alert" className="error">Could not load budgets. Check your connection and confirm the phase-2 migration is applied. Reload to retry.</p>
      ) : (
        <>
          <div className="placeholder">
            <p className="eyebrow">TOTAL PLANNED · {profile.currency}</p>
            <p className="total">{formatMoney(total, profile.currency)}</p>
            {missing > 0 && <p>{missing} active categor{missing === 1 ? "y has" : "ies have"} no limit set. This plan is incomplete.</p>}
            <p className="muted">Includes limits for archived categories. Spending tracking arrives in phase 3.</p>
          </div>
          <ActionForm key={`copy-${month}`} action={copyLimits} label="Copy previous month’s limits" secondary hidden={{ month }} />
          <p className="muted">Only fills missing limits for active categories. Existing limits are never overwritten.</p>
          <h2>Categories</h2>
          {active.length === 0 && <p>No active categories yet. Add one below to start your budget.</p>}
          {active.map((category, index) => (
            <article key={category.id} className="category">
              <h3>{category.name}</h3>
              <p>{amounts.has(category.id) ? formatMoney(amounts.get(category.id)!, profile.currency) : "Not set"}</p>
              <ActionForm key={`${category.id}-${month}`}
                action={saveLimit} label="Save limit" hidden={{ id: category.id, month }}
                fields={[{ name: "amount", label: `Monthly limit (${profile.currency})`, decimal: true,
                  value: amounts.has(category.id) ? amountInput(amounts.get(category.id)!) : "" }]} />
              <p className="muted">Leave blank and save to clear. Zero is a set limit.</p>
              {categoryControls(category, index)}
            </article>
          ))}
          <div className="category">
            <h2>Add a category</h2>
            <ActionForm action={addCategory} label="Add category" clearOnSuccess
              fields={[{ name: "name", label: "Name", required: true, maxLength: 60 }]} />
          </div>
          {archived.length > 0 && (
            <details className="category">
              <summary>Archived categories ({archived.length})</summary>
              <p className="muted">Historical limits are preserved. Restore a category to edit its limits.</p>
              {archived.map((category, index) => (
                <article key={category.id}>
                  <h3>{category.name}</h3>
                  <p>{amounts.has(category.id) ? formatMoney(amounts.get(category.id)!, profile.currency) : "Not set"} for {label}</p>
                  {categoryControls(category, index)}
                </article>
              ))}
            </details>
          )}
        </>
      )}
      <details className="category">
        <summary>Account preferences</summary>
        <p className="muted">Choose currency before setting limits; it cannot change while any monthly limits exist.
          Timezone controls your default month. Use a full name such as America/New_York.</p>
        <ActionForm key={`${profile.currency}-${profile.time_zone}`} action={savePreferences} label="Save preferences"
          fields={[
            { name: "currency", label: "Currency", value: profile.currency, options: CURRENCIES },
            { name: "time_zone", label: "Timezone", value: profile.time_zone, required: true },
          ]} />
      </details>
      <footer><p className="muted">Signed in as {user.email} · {profile.time_zone}</p>
        <form action={signOut}><button className="secondary">Sign out</button></form>
      </footer>
    </section>
  );
}
