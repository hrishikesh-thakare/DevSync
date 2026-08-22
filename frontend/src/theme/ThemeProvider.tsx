import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { ColorMode } from './colors';

interface ThemeContextValue {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode: ColorMode = 'dark';

  useEffect(() => {
    // Force dark mode globally
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode: () => {}, toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}