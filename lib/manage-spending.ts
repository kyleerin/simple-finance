import type { SupabaseClient } from "@supabase/supabase-js";
import type { parseSpending } from "./spending";

export async function changeSpending(
  supabase: SupabaseClient, ownerId: string, id: string, version: number,
  input: ReturnType<typeof parseSpending> | null,
) {
  const deleting = input === null;
  const changes = input ? {
    category_id: input.categoryId, amount_cents: input.amountCents,
    purchase_date: input.purchaseDate, note: input.note,
  } : { deleted_at: new Date().toISOString() };
  // PostgreSQL rechecks the version after concurrent row locks resolve, so a
  // stale form cannot overwrite an intervening edit or deletion.
  const { data, error } = await supabase.from("spending_entries").update(changes)
    .eq("owner_id", ownerId).eq("id", id).eq("version", version).is("deleted_at", null)
    .select("id,purchase_date,version")
    .returns<{ id: string; purchase_date: string; version: number }[]>();
  if (error) {
    const invalidCategory = error.code === "23514" || error.code === "23503";
    return { error: invalidCategory
      ? "Choose an active category, or keep this purchase’s original category."
      : "Save not confirmed. Reload to check current details before retrying.", status: invalidCategory ? 400 : 503 };
  }
  if (!data?.length) {
    return { error: "This purchase changed or was deleted in another tab. Reload to review the current details; your changes were not applied.", status: 409 };
  }
  return { saved: data[0], deleted: deleting };
}
