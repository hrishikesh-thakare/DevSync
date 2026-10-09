import { createContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: Theme;
  /** The resolved theme — 'light' or 'dark' — after applying OS preference when theme === 'system'. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'devsync-theme';

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

/**
 * Provides theme state to the whole application.
 *
 * The resolved theme class ('dark' or 'light') is applied directly to <html>
 * so Tailwind's `dark:` variant works out of the box. The selection is
 * persisted to localStorage under the key 'devsync-theme' and defaults to
 * 'system' on first visit so the OS preference is honoured automatically.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    } catch {
      // localStorage unavailable (private browsing / SSR guard)
    }
    return 'system';
  });

  const resolvedTheme = resolve(theme);

  // Apply class to <html> whenever the resolved theme changes.
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const resolved = resolve(theme);
      root.classList.remove('dark', 'light');
      root.classList.add(resolved);
      root.style.colorScheme = resolved;
    };

    apply();

    // Re-apply when the OS preference changes (only relevant while theme === 'system').
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write errors
    }
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
