"use client";

import { useTheme } from "@/lib/theme";

/** Light/dark theme toggle button for the header. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid h-10 w-10 place-items-center rounded-full text-lg hover:bg-slate-100 focus-ring"
    >
      <span aria-hidden>{dark ? "☀️" : "🌙"}</span>
    </button>
  );
}
