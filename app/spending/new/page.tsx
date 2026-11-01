import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireOwner } from "../../../lib/owner";
import { today } from "../../../lib/spending";
import { SpendingForm } from "./spending-form";

export const dynamic = "force-dynamic";

export default async function AddSpending() {
  const { supabase, user } = await requireOwner();
  const [{ data: profile }, { data: categories, error }] = await Promise.all([
    supabase.from("profiles").select("currency,time_zone").eq("id", user.id).single(),
    supabase.from("categories").select("id,name").eq("owner_id", user.id)
      .is("archived_at", null).order("display_order").order("id"),
  ]);
  return (
    <section className="card screen">
      <Link className="back-link" href="/">← Home</Link>
      <p className="eyebrow">SIMPLE FINANCE</p>
      <h1>Add spending</h1>
      {!profile || error ? (
        <p role="alert" className="error">Could not load the form. Check your connection and apply the budget migrations, then reload.</p>
      ) : categories?.length ? (
        <SpendingForm userId={user.id} currency={profile.currency} date={today(profile.time_zone)} timeZone={profile.time_zone}
          categories={categories} submissionId={randomUUID()} />
      ) : (
        <div className="action-stack">
          <p>Create or restore a category on your budget before recording spending.</p>
          <Link className="primary-link" href="/budget">Go to budget</Link>
        </div>
      )}
    </section>
  );
}
