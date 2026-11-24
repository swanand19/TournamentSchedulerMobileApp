import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import type { AuthOptions } from '@/api/types';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import Wallpaper from '@/components/Wallpaper';
import PressableScale from '@/components/PressableScale';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

import { dismissSuggestion, setClientUpdate, useClientUpdate } from './clientUpdate';

// The app's side of version updates (HLD P-25): asks where this version stands, covers the app when an
// update is required, and offers a dismissable banner on Home when one is only suggested.

const STORE_NAME = Constants.platform?.ios ? 'the App Store' : 'Google Play';

/** Asks AUTH_OPTIONS at start-up and each time the app comes back to the front (at most every 5 minutes). */
export function useUpdateCheck(enabled: boolean) {
  const last = useRef(0);
  const check = useCallback(async (force = false) => {
    if (!force && Date.now() - last.current < 5 * 60_000) return;
    last.current = Date.now();
    try {
      const options = await api.call<AuthOptions>('AUTH_OPTIONS');
      setClientUpdate(options.clientUpdate);
    } catch {
      // Unreachable: keep what we knew. A 426 on any call still brings the update screen up.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    check(true);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [enabled, check]);

  return check;
}

function openStore(url: string | null | undefined) {
  if (url) Linking.openURL(url).catch(() => {});
}

/** Covers the whole app while this version must update. Nothing behind it can be reached. */
export function UpdateRequiredScreen({ onCheckAgain }: { onCheckAgain: () => Promise<void> }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const { update } = useClientUpdate();
  const [checking, setChecking] = useState(false);
  const current = Constants.expoConfig?.version;

  const again = async () => {
    setChecking(true);
    await onCheckAgain();
    setChecking(false);
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.cover, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}
      accessibilityViewIsModal
    >
      <Wallpaper neutral />
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="cellphone-arrow-down" size={34} color={theme.accent} />
        </View>
        <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
          Update to keep using the app
        </Text>
        <Text style={[type.lead, { color: theme.onDark }]}>
          {update?.message ?? `This version of the app is no longer supported. Please update it from ${STORE_NAME}.`}
        </Text>
        {!!update?.description && (
          <View style={[styles.notes, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}>
            <Text style={[type.label, { color: theme.onDarkSoft }]}>
              {update.latestVersion ? `What's new in ${update.latestVersion}` : "What's new"}
            </Text>
            <Text style={[type.body, { color: theme.onDark }]}>{update.description}</Text>
          </View>
        )}
        {current && <Text style={[type.caption, { color: theme.onDarkSoft }]}>You have version {current}.</Text>}
      </View>
      <View style={styles.actions}>
        {update?.storeUrl ? (
          <Button label={`Update from ${STORE_NAME}`} icon="open-in-new" size="lg" onPress={() => openStore(update.storeUrl)} />
        ) : (
          <Text style={[type.body, { color: theme.onDark, textAlign: 'center' }]}>Open {STORE_NAME} and update KickCricket.</Text>
        )}
        <Button label={checking ? 'Checking…' : "I've updated — check again"} variant="deck" busy={checking} onPress={again} />
      </View>
    </View>
  );
}

/** Home's "a new version is available" line, until dismissed for that version. */
export function UpdateBanner() {
  const { type } = useTypography();
  const theme = useSportTheme();
  const { update, suggested } = useClientUpdate();
  if (!suggested || !update) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.deck, borderColor: theme.accentSoft }]} accessibilityRole="summary">
      <Icon name="arrow-up-bold-circle-outline" size={22} color={theme.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: theme.onDark }]}>Version {update.latestVersion} is available</Text>
        {!!update.description && (
          <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={2}>
            {update.description}
          </Text>
        )}
        {update.storeUrl && (
          <PressableScale onPress={() => openStore(update.storeUrl)} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Update from ${STORE_NAME}`}>
            <Text style={[type.bodyStrong, { color: theme.accent, marginTop: space.xs }]}>Update</Text>
          </PressableScale>
        )}
      </View>
      <PressableScale onPress={dismissSuggestion} hitSlop={12} accessibilityLabel="Not now — hide this until the next version">
        <Icon name="close" size={20} color={theme.onDarkSoft} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { zIndex: 100, paddingHorizontal: space.xl, justifyContent: 'space-between' },
  body: { gap: space.lg },
  badge: { width: 64, height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  notes: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  actions: { gap: space.md },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
});
