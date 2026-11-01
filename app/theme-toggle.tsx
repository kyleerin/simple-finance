"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch { /* Storage may be unavailable. */ }
  return "system";
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const next = readPreference();
    setPreference(next);
    applyPreference(next);
  }, []);

  function choose(next: ThemePreference) {
    setPreference(next);
    applyPreference(next);
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch { /* Preference still applies for this session. */ }
  }

  return (
    <fieldset className="theme-toggle">
      <legend>Theme</legend>
      {([
        ["system", "System"],
        ["light", "Light"],
        ["dark", "Dark"],
      ] as const).map(([value, label]) => (
        <label key={value}>
          <input
            type="radio"
            name="theme"
            value={value}
            checked={preference === value}
            onChange={() => choose(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
