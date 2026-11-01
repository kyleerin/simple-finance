"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { restoreSpendingSession, type SpendingDraft } from "../../../../lib/spending";

export function EditSpendingForm({ initial, version, currency, categories, userId }: {
  initial: SpendingDraft;
  version: number;
  currency: string;
  userId: string;
  categories: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ deleted: boolean; month: string } | null>(null);
  const update = (key: keyof SpendingDraft, value: string) => setDraft((old) => ({ ...old, [key]: value }));

  async function submit(deleting: boolean) {
    if (busy.current || (deleting && !window.confirm("Delete this purchase? It will be removed from spending totals and activity."))) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/spending/${initial.id}`, {
        method: deleting ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, version }),
      });
      const result = await response.json();
      if (!response.ok || !result.saved) {
        setError(result.error ?? "Save not confirmed. Reload to check this purchase before retrying.");
      } else {
        try {
          const key = `simple-finance:spending:${userId}`;
          if (restoreSpendingSession(sessionStorage.getItem(key))?.draft.id === initial.id) {
            sessionStorage.removeItem(key);
          }
        } catch { /* Storage is optional; current data remains in activity. */ }
        setDone({ deleted: result.deleted, month: result.saved.purchase_date.slice(0, 7) });
      }
    } catch {
      setError("Save not confirmed. Your input is kept. Reload in another tab to check whether the change saved before retrying here.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (done) return (
    <div role="status">
      <h2>{done.deleted ? "Purchase deleted" : "Purchase updated"}</h2>
      <p>Monthly totals now reflect this change.</p>
      <p><Link prefetch={false} href={`/activity?month=${done.month}`}>View activity</Link></p>
      <p><Link prefetch={false} href={`/?month=${done.month}`}>View monthly budget</Link></p>
    </div>
  );
  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
      <fieldset disabled={pending}>
        <label>Amount ({currency})<input inputMode="decimal" required value={draft.amount} onChange={(event) => update("amount", event.target.value)} /></label>
        <label>Category<select value={draft.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
          {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select></label>
        <label>Purchase date<input type="date" required min="1900-01-01" max="9999-12-31" value={draft.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} /></label>
        <label>Merchant or note (optional)<textarea maxLength={500} value={draft.note} onChange={(event) => update("note", event.target.value)} /></label>
        <button type="submit">{pending ? "Saving…" : "Save changes"}</button>
        <button type="button" className="danger" onClick={() => void submit(true)}>Delete purchase</button>
      </fieldset>
      <div aria-live="polite">{error && <p role="alert" className="error">{error}</p>}</div>
      <p className="muted">Editing the purchase date moves its spending to that date’s month. Conflicting changes from other tabs will not be overwritten.</p>
    </form>
  );
}
