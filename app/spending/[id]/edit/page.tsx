import Link from "next/link";
import { requireOwner } from "../../../../lib/owner";
import { amountInput } from "../../../../lib/budget";
import { isUuid } from "../../../../lib/spending";
import { EditSpendingForm } from "./edit-spending-form";

export const dynamic = "force-dynamic";

export default async function EditSpending({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireOwner();
  const { id } = await params;
  if (!isUuid(id)) {
    return (
      <section className="card screen">
        <h1>Purchase not found</h1>
        <Link className="primary-link" href="/activity">Activity</Link>
      </section>
    );
  }
  const [{ data: entry, error }, { data: categories, error: categoryError }, { data: profile }] = await Promise.all([
    supabase.from("spending_entries").select("id,category_id,amount_cents,purchase_date,note,version")
      .eq("owner_id", user.id).eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("categories").select("id,name,archived_at").eq("owner_id", user.id).order("display_order").order("id"),
    supabase.from("profiles").select("currency").eq("id", user.id).single(),
  ]);
  return (
    <section className="card screen">
      <Link className="back-link" href={entry ? `/activity?month=${entry.purchase_date.slice(0, 7)}` : "/activity"}>← Activity</Link>
      <h1>Edit purchase</h1>
      {error || categoryError || !profile ? <p role="alert" className="error">Could not load this purchase. Apply the phase-4 migration and reload.</p>
        : !entry ? <p>This purchase does not exist or was deleted.</p>
        : <EditSpendingForm key={`${id}-${entry.version}`} userId={user.id} currency={profile.currency} version={Number(entry.version)}
          initial={{ id, categoryId: entry.category_id, amount: amountInput(Number(entry.amount_cents)), purchaseDate: entry.purchase_date, note: entry.note ?? "" }}
          categories={(categories ?? []).filter((category) => !category.archived_at || category.id === entry.category_id)
            .map((category) => ({ id: category.id, name: `${category.name}${category.archived_at ? " (archived)" : ""}` }))} />}
    </section>
  );
}
