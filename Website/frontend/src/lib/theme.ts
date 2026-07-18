"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "rt-theme";

/** Apply the theme class to <html> and persist the choice. */
function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore storage errors (private mode) */
  }
}

/** Read the current theme from <html> (set by the no-flash boot script). */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Hook: current theme + a toggle. Syncs to <html class="dark"> and localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  // Read the real value after mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    apply(next);
    setTheme(next);
  };

  return { theme, toggle };
}

/**
 * Inline script string run before paint to set the theme class from
 * localStorage (or the OS preference), preventing a light-mode flash.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem('${STORAGE_KEY}');
  if(!t){ t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  if(t === 'dark'){ document.documentElement.classList.add('dark'); }
}catch(e){}})();
`;
