import { redirect } from "next/navigation";
import { isAllowedEmail } from "./access";
import { createClient } from "./supabase";

// Every protected read and mutation checks identity independently of the UI.
export async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at || !isAllowedEmail(user.email, process.env.ALLOWED_EMAIL)) {
    redirect("/login");
  }
  return { supabase, user };
}
