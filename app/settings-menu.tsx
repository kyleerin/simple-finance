"use client";

import { ThemeToggle } from "./theme-toggle";

export function SettingsMenu() {
  return (
    <details className="settings-bar">
      <summary className="settings-button">Settings</summary>
      <div className="settings-menu" role="group" aria-label="Settings options">
        <ThemeToggle />
      </div>
    </details>
  );
}
