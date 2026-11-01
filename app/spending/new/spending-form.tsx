"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../../../lib/budget";
import { restoreSpendingSession, today, type SpendingDraft, type SpendingReceipt } from "../../../lib/spending";

export function SpendingForm({ userId, currency, date, timeZone, categories, submissionId }: {
  userId: string;
  currency: string;
  date: string;
  timeZone: string;
  categories: { id: string; name: string }[];
  submissionId: string;
}) {
  const blank = (id: string, purchaseDate = date): SpendingDraft => ({ id, amount: "", categoryId: "", purchaseDate, note: "" });
  const [draft, setDraft] = useState<SpendingDraft>(() => blank(submissionId));
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SpendingReceipt | null>(null);
  const [changedRetry, setChangedRetry] = useState(false);
  const [deletedSubmission, setDeletedSubmission] = useState(false);
  const storageKey = `simple-finance:spending:${userId}`;

  useEffect(() => {
    try {
      const stored = restoreSpendingSession(sessionStorage.getItem(storageKey));
      if (stored) {
        setDraft(stored.draft);
        setReceipt(stored.receipt);
        setChangedRetry(stored.changedRetry);
      }
    } catch { /* Storage may be unavailable; in-memory retries still work. */ }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (ready) {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ draft, receipt, changedRetry })); }
      catch { /* The form still retains input while this page stays open. */ }
    }
  }, [draft, receipt, changedRetry, ready, storageKey]);

  const update = (key: keyof SpendingDraft, value: string) => setDraft((old) => ({ ...old, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/spending", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok || !result.receipt) {
        setError(result.error ?? "Save not confirmed. Retry this entry.");
        setDeletedSubmission(response.status === 410);
      } else {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({
            draft, receipt: result.receipt, changedRetry: result.changedRetry === true,
          }));
        } catch {}
        setReceipt(result.receipt);
        setChangedRetry(result.changedRetry === true);
        // Keep the ID until an explicit "Add another" so a reload after success
        // can safely retrieve the same receipt, rather than record it twice.
      }
    } catch {
      setError("Save not confirmed. Your input is kept. Check your connection and retry; this entry will not be duplicated.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function startAnother() {
    const next = blank(crypto.randomUUID(), today(timeZone));
    try { sessionStorage.setItem(storageKey, JSON.stringify({ draft: next, receipt: null, changedRetry: false })); } catch {}
    setDraft(next);
    setReceipt(null);
    setChangedRetry(false);
    setDeletedSubmission(false);
    setError("");
  }

  if (receipt) {
    return (
      <div role="status" className="action-stack">
        <h2 className="success">Spending saved</h2>
        {changedRetry && <p className="error">This submission was already saved with different details. The original is shown below; no second entry was created.</p>}
        <p className="total">{formatMoney(receipt.amountCents, receipt.currency)}</p>
        <p>{receipt.categoryName} · {receipt.purchaseDate}</p>
        {receipt.note && <p className="receipt-note">{receipt.note}</p>}
        <p>Recorded in {receipt.purchaseDate.slice(0, 7)}, based on the purchase date.</p>
        <p className="muted">This is your saved confirmation. Activity shows current details if the purchase was later edited or deleted.</p>
        <div className="home-actions compact">
          <button type="button" onClick={startAnother}>Add another purchase</button>
          <Link className="nav-link" href={`/?month=${receipt.purchaseDate.slice(0, 7)}`}>Back to this month’s budget</Link>
          <Link className="nav-link" prefetch={false} href={`/spending/${receipt.id}/edit`}>View current purchase or edit</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="action-stack">
      <fieldset disabled={pending || !ready}>
        <label>Amount ({currency})
          <input name="amount" inputMode="decimal" autoComplete="off" required
            value={draft.amount} onChange={(event) => update("amount", event.target.value)} />
        </label>
        <fieldset className="category-picker">
          <legend>Category</legend>
          {categories.map((category) => (
            <label key={category.id} className={draft.categoryId === category.id ? "selected" : ""}>
              <input type="radio" name="category" value={category.id} required
                checked={draft.categoryId === category.id} onChange={() => update("categoryId", category.id)} />
              {category.name}
            </label>
          ))}
        </fieldset>
        {draft.categoryId && !categories.some((category) => category.id === draft.categoryId)
          && <p className="error">Your previous category is no longer active. Choose another category.</p>}
        <label>Purchase date
          <input name="purchaseDate" type="date" required min="1900-01-01" max="9999-12-31"
            value={draft.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} />
        </label>
        <details>
          <summary>{draft.note ? "Note added (edit)" : "Add a note (optional)"}</summary>
          <label>Merchant or note
            <textarea name="note" maxLength={500} value={draft.note}
              onChange={(event) => update("note", event.target.value)} />
          </label>
        </details>
        <div className="sticky-actions">
          <button type="submit">{pending ? "Saving…" : "Save spending"}</button>
          {deletedSubmission && <button type="button" className="secondary" onClick={startAnother}>Start a new purchase</button>}
        </div>
      </fieldset>
      <p className="muted">Online only. A purchase is saved only when you see confirmation.
        Unsaved input is kept in this tab where browser storage is available.</p>
      <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}</div>
    </form>
  );
}
