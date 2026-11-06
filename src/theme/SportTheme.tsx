import { createContext, useContext, type ReactNode } from 'react';

import { useThemeMode } from '@/theme/appearance';
import { neutralTheme, themeFor, typographyFor, type AppTheme, type ThemeMode, type Typography } from '@/theme/theme';

// The palette for whatever sport the screen belongs to, in the person's chosen appearance (dark or
// light). Everything inside a tournament reads it from here, so no component is handed the sport
// just to pick a colour. Outside any tournament it is football's (the glass theme's neutral light).

const SportContext = createContext<string | undefined>(undefined);

export function SportThemeProvider({ sport, children }: { sport: string | undefined; children: ReactNode }) {
  return <SportContext.Provider value={sport}>{children}</SportContext.Provider>;
}

/** The sport this part of the app belongs to, or undefined outside any tournament. */
export function useSportKey(): string | undefined {
  return useContext(SportContext);
}

export function useSportTheme(): AppTheme {
  const sport = useContext(SportContext);
  const mode = useThemeMode();
  // Outside a tournament the glass theme has its own neutral light (still football for the light theme).
  return sport === undefined && mode === 'dark' ? neutralTheme : themeFor(sport, mode);
}

/** The fonts and type scale of the chosen appearance. */
export function useTypography(): Typography {
  return typographyFor(useThemeMode());
}

const styleCache = new WeakMap<object, Partial<Record<ThemeMode, unknown>>>();

/**
 * A stylesheet that names fonts, built once per appearance: `const makeStyles = ({ fonts }:
 * Typography) => StyleSheet.create({…})`, then `const styles = useThemedStyles(makeStyles)`.
 */
export function useThemedStyles<T>(make: (t: Typography) => T): T {
  const mode = useThemeMode();
  let byMode = styleCache.get(make);
  if (!byMode) {
    byMode = {};
    styleCache.set(make, byMode);
  }
  if (!(mode in byMode)) byMode[mode] = make(typographyFor(mode));
  return byMode[mode] as T;
}
