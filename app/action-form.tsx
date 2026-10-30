"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "../lib/budget";

type Field = {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
  decimal?: boolean;
  options?: readonly string[];
};

export function ActionForm({
  action, fields = [], hidden = {}, label, secondary = false, confirm,
  clearOnSuccess = false,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  fields?: Field[];
  hidden?: Record<string, string>;
  label: string;
  secondary?: boolean;
  confirm?: string;
  clearOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const initialValues = JSON.stringify(Object.fromEntries(
    fields.map((field) => [field.name, field.value ?? ""]),
  ));
  const [values, setValues] = useState<Record<string, string>>(
    () => JSON.parse(initialValues),
  );
  // Refresh displayed values after copying/saving, but don't discard typed
  // input on validation failures or unrelated server re-renders.
  useEffect(() => { setValues(JSON.parse(initialValues)); }, [initialValues]);
  useEffect(() => {
    if (state.success && clearOnSuccess) setValues({});
  }, [state, clearOnSuccess]);

  return (
    <form action={formAction} onSubmit={(event) => {
      if (confirm && !window.confirm(confirm)) event.preventDefault();
    }}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <fieldset disabled={pending}>
        {fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.options ? (
              <select name={field.name} value={values[field.name] ?? ""} onChange={(event) =>
                setValues((old) => ({ ...old, [field.name]: event.target.value }))
              }>
                {field.options.map((value) => <option key={value}>{value}</option>)}
              </select>
            ) : (
              <input name={field.name} value={values[field.name] ?? ""}
                required={field.required} maxLength={field.maxLength}
                inputMode={field.decimal ? "decimal" : undefined}
                onChange={(event) => setValues((old) => ({ ...old, [field.name]: event.target.value }))} />
            )}
          </label>
        ))}
        <button type="submit" className={secondary ? "secondary" : undefined}>
          {pending ? "Saving…" : label}
        </button>
      </fieldset>
      <div aria-live="polite">
        {state.error && <p role="alert" className="error">{state.error}</p>}
        {state.success && <p className="success">{state.success}</p>}
      </div>
    </form>
  );
}
