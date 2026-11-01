import type { SupabaseClient } from "@supabase/supabase-js";
import { monthBounds } from "./activity";
import { validMonth } from "./budget";

/** Soft-delete every live purchase in the calendar month. Loops until none
 * remain so PostgREST max-rows cannot leave undeleted activity behind. */
export async function resetMonthActivity(
  supabase: SupabaseClient,
  ownerId: string,
  month: string,
) {
  if (!validMonth(month)) {
    return { error: "Choose a valid month.", status: 400 as const };
  }
  const { start, end } = monthBounds(month);
  let removed = 0;
  for (;;) {
    const deletedAt = new Date().toISOString();
    const { data, error } = await supabase.from("spending_entries")
      .update({ deleted_at: deletedAt })
      .eq("owner_id", ownerId)
      .is("deleted_at", null)
      .gte("purchase_date", start)
      .lte("purchase_date", end)
      .select("id")
      .returns<{ id: string }[]>();
    if (error) {
      return {
        error: "Could not reset activity. Check your connection and database setup, then try again.",
        status: 503 as const,
      };
    }
    const count = data?.length ?? 0;
    removed += count;
    if (count === 0) break;
  }
  return { removed };
}
