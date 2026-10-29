import { redirect } from "next/navigation";
import { isAllowedEmail } from "../lib/access";
import { createClient } from "../lib/supabase";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at || !isAllowedEmail(user.email, process.env.ALLOWED_EMAIL)) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  return (
    <section className="card">
      <p className="eyebrow">SIMPLE FINANCE</p>
      <h1>Your private budget starts here.</h1>
      <p>Signed in as {user.email}.</p>
      {error || !profile ? (
        <p role="alert" className="error">Database setup needs attention. Apply the foundation migration and confirm your profile exists.</p>
      ) : (
        <p className="success">Account and database connected.</p>
      )}
      <div className="placeholder">
        <h2>Foundation ready</h2>
        <p>Categories, monthly limits, and spending entry will arrive in the next phases. No financial data is being collected yet.</p>
      </div>
      <form action={signOut}><button className="secondary" type="submit">Sign out</button></form>
    </section>
  );
}
