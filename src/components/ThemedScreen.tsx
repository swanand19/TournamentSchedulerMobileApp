import { Fragment, useContext, type ReactElement } from 'react';
import { View } from 'react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';

import Wallpaper from '@/components/Wallpaper';
import { useThemeMode } from '@/theme/appearance';

// Every screen of a stack, laid on its ground: the glass theme's wallpaper (the sport's, inside a
// tournament; the neutral one outside) or the light theme's white. Drawn here, once per screen, so
// screens keep their own roots clear and a pushed screen slides in with its wallpaper.
//
// In the glass theme the header is transparent (see the stacks' screenOptions): the bar's title and
// buttons float over the wallpaper, which runs unbroken to the top of the screen, and the screen's
// own content starts below the bar.
//
// It also rebuilds a screen when the theme changes instead of restyling it in place. Android
// doesn't fully redraw a native view whose clipping or border style changes at runtime: after
// switching light → dark, the profile's cricket card showed only its background and the football
// card lost its dashed edge. A fresh tree draws correctly. The switch happens under
// ThemeTransition's picture, so the rebuild (and the screen reloading its data) isn't seen.

function ThemedScreen({ children }: { children: ReactElement }) {
  const mode = useThemeMode();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <View style={{ flex: 1, paddingTop: mode === 'dark' ? headerHeight : 0 }}>
      <Wallpaper />
      <Fragment key={mode}>{children}</Fragment>
    </View>
  );
}

type LayoutArgs = { children: ReactElement; route: { name: string } };

/**
 * A stack's `screenLayout`. Screens that hold a navigator of their own (the tournament) are left
 * alone: rebuilding them would drop their history; their stack rebuilds its screens itself.
 */
export function themedScreenLayout(...nested: string[]) {
  return function ThemedScreenLayout({ children, route }: LayoutArgs) {
    return nested.includes(route.name) ? children : <ThemedScreen>{children}</ThemedScreen>;
  };
}
