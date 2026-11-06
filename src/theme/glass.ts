import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// How this phone can draw glass. Three answers:
//  - native:  iOS 26 or later — Apple's own Liquid Glass (lensing, adaptive light, the touch glow),
//             through expo-glass-effect's GlassView.
//  - blur:    earlier iOS and the web — a frosted blur (expo-blur) under our own glass edge.
//  - solid:   Android, or anyone with Reduce Transparency on — no live blur; a denser fill where
//             glass floats over moving content, so text over it stays readable.
// Reduce Transparency is followed live: switching it in Settings changes the app at once.

export type GlassSupport = 'native' | 'blur' | 'solid';

// isGlassEffectAPIAvailable guards the iOS 26 betas that have the component but crash using it.
const nativeAvailable = (() => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

let reduceTransparency = false;
const listeners = new Set<() => void>();
let watching = false;

function watch() {
  // Only iOS has the setting (react-native-web doesn't even have the call).
  if (watching || Platform.OS !== 'ios') return;
  watching = true;
  const set = (on: boolean) => {
    if (on === reduceTransparency) return;
    reduceTransparency = on;
    listeners.forEach((l) => l());
  };
  AccessibilityInfo.isReduceTransparencyEnabled()
    .then(set)
    .catch(() => {});
  AccessibilityInfo.addEventListener('reduceTransparencyChanged', set);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function current(): GlassSupport {
  if (reduceTransparency || Platform.OS === 'android') return 'solid';
  return nativeAvailable ? 'native' : 'blur';
}

export function useGlassSupport(): GlassSupport {
  useEffect(watch, []);
  return useSyncExternalStore(subscribe, current, current);
}
