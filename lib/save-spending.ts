import type { SupabaseClient } from "@supabase/supabase-js";
import { matchesReceipt, type parseSpending, type SpendingReceipt } from "./spending";

type SavedSpending = {
  id: string;
  category_id: string;
  amount_cents: number;
  purchase_date: string;
  note: string | null;
};

export async function saveSpending(
  supabase: SupabaseClient,
  ownerId: string,
  input: ReturnType<typeof parseSpending>,
) {
  // Request a singular PostgREST representation explicitly for this composite
  // return type, rather than assuming whether RPC data is an array or object.
  const { data: saved, error } = await supabase.rpc("record_spending", {
    submission_id: input.id, category: input.categoryId, cents: input.amountCents,
    purchased_on: input.purchaseDate, entry_note: input.note,
  }).single<SavedSpending>();
  if (error || !saved) {
    const invalidCategory = error?.code === "23514" || error?.code === "23503";
    return {
      error: invalidCategory
        ? "Choose an active category. It may have been archived in another tab."
        : "Save not confirmed. Check your connection and database setup, then retry this entry.",
      status: invalidCategory ? 400 : 503,
    };
  }
  // Read currency only after the write: it is now protected by spending history.
  const [{ data: profile }, { data: category }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", ownerId).single(),
    supabase.from("categories").select("name").eq("id", saved.category_id).eq("owner_id", ownerId).single(),
  ]);
  if (!profile || !category) {
    return { error: "Could not confirm the saved details. Retry this entry; it will not be duplicated.", status: 503 };
  }
  const receipt: SpendingReceipt = {
    id: saved.id, categoryId: saved.category_id, categoryName: category.name,
    amountCents: Number(saved.amount_cents), purchaseDate: saved.purchase_date,
    note: saved.note, currency: profile.currency,
  };
  return { receipt, changedRetry: !matchesReceipt(input, receipt) };
}
