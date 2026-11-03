"use client";

import { usePathname } from "next/navigation";
import { showAppSettings } from "../lib/settings";
import { ActionForm } from "./action-form";
import { resetThisMonthActivity } from "./reset-activity-action";
import { ThemeToggle } from "./theme-toggle";

export function SettingsMenu() {
  const pathname = usePathname();
  if (!showAppSettings(pathname)) return null;

  return (
    <details className="settings-bar">
      <summary className="settings-button">Settings</summary>
      <div className="settings-menu" role="group" aria-label="Settings options">
        <ThemeToggle />
        <div className="settings-reset">
          <p className="muted">Soft-delete every purchase in the current month. Limits stay set.</p>
          <ActionForm
            action={resetThisMonthActivity}
            label="Reset this month’s activity"
            danger
            confirm="Delete all purchases for the current month? They will be removed from spending totals and activity. This cannot be undone in the app."
          />
        </div>
      </div>
    </details>
  );
}
