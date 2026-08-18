import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeSetting, setThemeSetting] = useState(() => {
    return localStorage.getItem('aura-theme') || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (themeSetting === 'dark' || themeSetting === 'light') return themeSetting;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    localStorage.setItem('aura-theme', themeSetting);

    const updateResolvedTheme = () => {
      let active = themeSetting;
      if (themeSetting === 'system') {
        active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      setResolvedTheme(active);
      document.documentElement.setAttribute('data-theme', active);
    };

    updateResolvedTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeSetting === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSetting]);

  const cycleTheme = () => {
    if (themeSetting === 'system') setThemeSetting('dark');
    else if (themeSetting === 'dark') setThemeSetting('light');
    else setThemeSetting('system');
  };

  return (
    <ThemeContext.Provider
      value={{
        themeSetting,
        setThemeSetting,
        resolvedTheme,
        cycleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
