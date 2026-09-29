import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { AppTheme } from '@/theme/theme';

// The mown-pitch stripes behind every screen, the website's repeating-linear-gradient redrawn as
// flat bands (React Native has no CSS gradients). Static, so it costs nothing after first paint.

const BAND = 96;

export default function PitchBackground({ theme }: { theme: AppTheme }) {
  const { height } = useWindowDimensions();
  const count = Math.ceil(height / BAND) + 1;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.page }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height: BAND, backgroundColor: theme.stripes[i % 2] }} />
      ))}
    </View>
  );
}
