import { useContext } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';

import { useSportKey, useSportTheme } from '@/theme/SportTheme';
import { neutralWall } from '@/theme/theme';

// The ground behind every screen. Glass: a deep base with three soft glows of the sport's colours
// (blue-violet for cricket, teal for football, the two together outside a tournament), drawn as
// native radial gradients — static, so it costs nothing after the first paint. Light: plain white.
// Every stack draws it under each screen (see ThemedScreen), so screens keep their own roots clear.
// A screen that sets its own sport (a career page) draws its own on top, `underHeader` so it runs
// up behind the transparent bar like the stack's does.

export default function Wallpaper({ neutral, underHeader }: { neutral?: boolean; underHeader?: boolean }) {
  const theme = useSportTheme();
  const sport = useSportKey();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const glass = theme.mode === 'dark';
  const { page, wall } = glass && (neutral || sport === undefined) ? neutralWall : theme;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        underHeader && glass && { top: -headerHeight },
        { backgroundColor: page },
        glass && (Platform.OS === 'web' ? ({ backgroundImage: wall } as object) : { experimental_backgroundImage: wall }),
      ]}
    />
  );
}
