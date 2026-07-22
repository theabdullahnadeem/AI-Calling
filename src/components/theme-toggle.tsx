"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "digivixo-theme";

type Theme = "light" | "dark";

/**
 * App-wide theme toggle. The initial theme is applied before paint by the
 * inline script in layout.tsx (no flash); this control just flips it and
 * persists the choice. Reads the current value from the <html> data-theme the
 * script already set, so button and page never disagree.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current =
      (document.documentElement.dataset.theme as Theme | undefined) ?? "light";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the choice just won't persist.
    }
    setTheme(next);
  }

  // Render nothing until mounted so SSR markup can't assert the wrong icon.
  if (!mounted) return null;

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle fixed right-4 bottom-4 z-50 w-10 h-10 rounded-full border border-line bg-card text-ink shadow-md flex items-center justify-center cursor-pointer hover:border-signal transition-colors duration-200"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        // Sun
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Moon
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
