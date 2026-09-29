import { createContext, useContext, type ReactNode } from 'react';

import { footballTheme, themeFor, type AppTheme } from '@/theme/theme';

// The palette for whatever sport the screen belongs to. Everything inside a tournament reads it
// from here, so no component is handed the sport just to pick a colour.

const SportThemeContext = createContext<AppTheme>(footballTheme);

export function SportThemeProvider({ sport, children }: { sport: string | undefined; children: ReactNode }) {
  return <SportThemeContext.Provider value={themeFor(sport)}>{children}</SportThemeContext.Provider>;
}

export function useSportTheme(): AppTheme {
  return useContext(SportThemeContext);
}
