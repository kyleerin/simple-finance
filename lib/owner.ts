import { redirect } from "next/navigation";
import { isAllowedEmail } from "./access";
import { createClient } from "./supabase";

export async function getOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at || !isAllowedEmail(user.email, process.env.ALLOWED_EMAIL)) {
    return null;
  }
  return { supabase, user };
}

// Every protected read and mutation checks identity independently of the UI.
export async function requireOwner() {
  const owner = await getOwner();
  if (!owner) redirect("/login");
  return owner;
}
