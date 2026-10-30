"use server";

import { redirect } from "next/navigation";
import { isAllowedEmail } from "../lib/access";
import { createClient } from "../lib/supabase";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!isAllowedEmail(email, process.env.ALLOWED_EMAIL)) {
    redirect("/login?error=credentials");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (
    error ||
    !data.user?.email_confirmed_at ||
    !isAllowedEmail(data.user?.email, process.env.ALLOWED_EMAIL)
  ) {
    await supabase.auth.signOut();
    redirect("/login?error=credentials");
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
