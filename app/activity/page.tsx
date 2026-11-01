import Link from "next/link";
import { requireOwner } from "../../lib/owner";
import { currentMonth, formatMoney, validMonth } from "../../lib/budget";
import { isUuid } from "../../lib/spending";
import { ACTIVITY_PAGE_SIZE, activityPage, monthBounds } from "../../lib/activity";

export const dynamic = "force-dynamic";

export default async function Activity({ searchParams }: {
  searchParams: Promise<{ month?: string | string[]; category?: string | string[]; page?: string | string[] }>;
}) {
  const { supabase, user } = await requireOwner();
  const { data: profile } = await supabase.from("profiles").select("currency,time_zone").eq("id", user.id).single();
  if (!profile) return <section className="card"><p role="alert">Could not load account preferences. Reload to retry.</p><Link className="nav-link" href="/">Budget</Link></section>;
  const params = await searchParams;
  const month = validMonth(params.month) ? params.month : currentMonth(profile.time_zone);
  const page = activityPage(params.page);
  const requestedCategory = isUuid(params.category) ? params.category : "";
  const bounds = monthBounds(month);
  const { data: categories, error: categoryError } = await supabase.from("categories")
    .select("id,name,archived_at").eq("owner_id", user.id).order("display_order").order("id");
  const category = categories?.some((item) => item.id === requestedCategory) ? requestedCategory : "";
  let query = supabase.from("spending_entries").select("id,category_id,amount_cents,purchase_date,note", { count: "exact" })
    .eq("owner_id", user.id).is("deleted_at", null).gte("purchase_date", bounds.start).lte("purchase_date", bounds.end)
    .order("purchase_date", { ascending: false }).order("created_at", { ascending: false }).order("id");
  if (category) query = query.eq("category_id", category);
  const { data: entries, error, count } = await query.range((page - 1) * ACTIVITY_PAGE_SIZE, page * ACTIVITY_PAGE_SIZE - 1);
  const names = new Map((categories ?? []).map((item) => [item.id, `${item.name}${item.archived_at ? " (archived)" : ""}`]));
  const href = (target: number) => `/activity?${new URLSearchParams({ month, ...(category ? { category } : {}), page: String(target) })}`;
  return (
    <section className="card budget screen">
      <Link className="back-link" href={`/?month=${month}`}>← Monthly budget</Link>
      <h1>Activity</h1>
      <div className="home-actions compact">
        <Link className="primary-link" href="/spending/new">+ Add spending</Link>
      </div>
      <form method="get" className="action-stack">
        <label>Month<input type="month" name="month" defaultValue={month} min="1900-01" max="9999-12" required /></label>
        <label>Category<select name="category" defaultValue={category}>
          <option value="">All categories</option>
          {(categories ?? []).map((item) => <option key={item.id} value={item.id}>{names.get(item.id)}</option>)}
        </select></label>
        <button>Apply filters</button>
      </form>
      {((params.month && !validMonth(params.month)) || (params.category && !category))
        && <p role="alert" className="error">Invalid filter. Showing the default for that filter.</p>}
      {error || categoryError ? <p role="alert" className="error">Could not load activity. Apply the phase-4 migration and reload to retry.</p> : (
        <>
          <p>{count ?? 0} purchase{count === 1 ? "" : "s"} · {month}</p>
          {!entries?.length && <p>No purchases on this page. Change filters or return to <Link href={href(1)}>page 1</Link>.</p>}
          {entries?.map((entry) => (
            <article className="category activity-entry" key={entry.id}>
              <h2>{formatMoney(Number(entry.amount_cents), profile.currency)} · {names.get(entry.category_id) ?? "Category unavailable"}</h2>
              <p><time dateTime={entry.purchase_date}>{entry.purchase_date}</time></p>
              {entry.note && <p className="receipt-note">{entry.note}</p>}
              <Link className="nav-link" prefetch={false} href={`/spending/${entry.id}/edit`}>Edit or delete purchase</Link>
            </article>
          ))}
          <nav className="month-nav" aria-label="Activity pages">
            {page > 1 ? <Link href={href(page - 1)}>← Previous page</Link> : <span aria-hidden="true" />}
            <span>Page {page}</span>
            {page * ACTIVITY_PAGE_SIZE < (count ?? 0) ? <Link href={href(page + 1)}>Next page →</Link> : <span aria-hidden="true" />}
          </nav>
        </>
      )}
    </section>
  );
}
