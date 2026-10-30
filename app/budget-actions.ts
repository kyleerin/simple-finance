"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "../lib/owner";
import {
  categoryName, CURRENCIES, parseAmount, validMonth, validTimeZone, type ActionState,
} from "../lib/budget";

function field(data: FormData, name: string) {
  return String(data.get(name) ?? "");
}

function monthField(data: FormData) {
  const month = field(data, "month");
  if (!validMonth(month)) throw new Error("Choose a valid month.");
  return `${month}-01`;
}

function idField(data: FormData) {
  const id = field(data, "id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid category.");
  }
  return id;
}

function failure(error: { code?: string }): ActionState {
  if (error.code === "23505") return { error: "That category name already exists, possibly in archived categories." };
  if (error.code === "23503") return { error: "This category has monthly limits. Archive it instead to preserve history." };
  return { error: "Could not save. Check your connection and database setup, then try again." };
}

// Authentication stays outside validation catches: redirects must propagate.
export async function addCategory(_: ActionState, data: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  let name: string;
  try { name = categoryName(field(data, "name")); }
  catch (error) { return { error: (error as Error).message }; }
  const { error } = await supabase.from("categories").insert({ owner_id: user.id, name });
  if (error) return failure(error);
  revalidatePath("/");
  return { success: "Category added." };
}

export async function changeCategory(_: ActionState, data: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  let id: string;
  let name: string | undefined;
  const operation = field(data, "operation");
  try {
    id = idField(data);
    if (operation === "rename") name = categoryName(field(data, "name"));
    else if (!["archive", "restore", "delete", "up", "down"].includes(operation)) {
      throw new Error("Invalid category action.");
    }
  } catch (error) { return { error: (error as Error).message }; }

  if (operation === "up" || operation === "down") {
    const { error } = await supabase.rpc("move_category", { category: id, direction: operation === "up" ? -1 : 1 });
    if (error) return failure(error);
  } else {
    const query = operation === "delete"
      ? supabase.from("categories").delete()
      : supabase.from("categories").update(
        operation === "rename" ? { name } : { archived_at: operation === "archive" ? new Date().toISOString() : null },
      );
    const { data: changed, error } = await query.eq("id", id).eq("owner_id", user.id).select("id");
    if (error) return failure(error);
    if (!changed?.length) return { error: "Category no longer exists. Reload the page." };
  }
  revalidatePath("/");
  return { success: operation === "delete" ? "Category deleted." : "Category updated." };
}

export async function saveLimit(_: ActionState, data: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  let category: string;
  let month: string;
  let amount: number | null;
  try {
    category = idField(data);
    month = monthField(data);
    const raw = field(data, "amount").trim();
    amount = raw === "" ? null : parseAmount(raw);
  } catch (error) { return { error: (error as Error).message }; }
  const { error } = amount === null
    ? await supabase.from("monthly_limits").delete().eq("category_id", category).eq("owner_id", user.id).eq("month", month)
    : await supabase.from("monthly_limits").upsert(
      { category_id: category, owner_id: user.id, month, amount_cents: amount },
      { onConflict: "category_id,month" },
    );
  if (error) return failure(error);
  revalidatePath("/");
  return { success: amount === null ? "Limit cleared. Now not set." : "Monthly limit saved." };
}

export async function copyLimits(_: ActionState, data: FormData): Promise<ActionState> {
  const { supabase } = await requireOwner();
  let month: string;
  try { month = monthField(data); }
  catch (error) { return { error: (error as Error).message }; }
  const { data: count, error } = await supabase.rpc("copy_previous_limits", { target_month: month });
  if (error) return failure(error);
  revalidatePath("/");
  return { success: `${count} limit${count === 1 ? "" : "s"} copied. Existing limits were left unchanged.` };
}

export async function savePreferences(_: ActionState, data: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOwner();
  const currency = field(data, "currency");
  const timeZone = field(data, "time_zone").trim();
  if (!CURRENCIES.some((item) => item === currency) || !validTimeZone(timeZone)) {
    return { error: "Choose a supported currency and a valid timezone, such as America/New_York." };
  }
  const { data: changed, error } = await supabase.from("profiles")
    .update({ currency, time_zone: timeZone }).eq("id", user.id).select("id");
  if (error?.code === "23514") {
    return { error: "Currency cannot change while monthly limits exist. Also check the timezone is a full IANA name." };
  }
  if (error) return failure(error);
  if (!changed?.length) return { error: "Account profile is missing. Check database setup." };
  revalidatePath("/");
  return { success: "Preferences saved." };
}
