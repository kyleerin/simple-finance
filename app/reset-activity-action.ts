"use server";

import { revalidatePath } from "next/cache";
import { currentMonth, type ActionState } from "../lib/budget";
import { requireOwner } from "../lib/owner";
import { resetMonthActivity } from "../lib/reset-activity";

export async function resetThisMonthActivity(
  _state: ActionState,
  _data: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("time_zone").eq("id", user.id).single();
  if (profileError || !profile) {
    return { error: "Could not load account preferences. Reload to retry." };
  }
  const month = currentMonth(profile.time_zone);
  const result = await resetMonthActivity(supabase, user.id, month);
  if (result.error) return { error: result.error };
  revalidatePath("/", "layout");
  const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00Z`));
  if (result.removed === 0) {
    return { success: `No purchases to reset for ${label}.` };
  }
  return {
    success: `Removed ${result.removed} purchase${result.removed === 1 ? "" : "s"} from ${label}.`,
  };
}
