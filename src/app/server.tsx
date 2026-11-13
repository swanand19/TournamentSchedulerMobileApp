import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { normaliseServerAddress, SERVER_LOCKED, useServer, type ConnectionTest } from '@/config/server';
import { useKeyboardRoom } from '@/hooks/useKeyboardRoom';
import { useThemedStyles, useTypography } from '@/theme/SportTheme';
import { footballTheme as theme, radius, space, type Typography } from '@/theme/theme';

// Where the API lives. The laptop's IP changes when the router hands out a new one, so this is a
// ten-second fix in the app rather than a new build. Installed builds (SERVER_LOCKED) can't change it:
// there the screen only checks the connection, for "is it the app or the server?".

export default function ServerScreen() {
  return SERVER_LOCKED ? <ConnectionCheck /> : <ServerForm />;
}

function ConnectionCheck() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const { baseUrl, test } = useServer();
  const [result, setResult] = useState<ConnectionTest | null>(null);
  const [busy, setBusy] = useState(false);

  const runTest = async () => {
    setBusy(true);
    setResult(null);
    setResult(await test(baseUrl));
    setBusy(false);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.cream }} contentContainerStyle={styles.body}>
      <Text style={[type.body, { color: theme.muted }]}>
        Check that this phone can reach the server. If it can&apos;t, look at the phone&apos;s internet connection first.
      </Text>
      <Text style={[type.caption, { color: theme.muted }]}>{baseUrl}</Text>
      <PressableScale onPress={runTest} disabled={busy} style={styles.secondary}>
        {busy ? <ActivityIndicator color={theme.deep} /> : <Text style={styles.secondaryText}>Test connection</Text>}
      </PressableScale>
      {result && <TestResult result={result} />}
    </ScrollView>
  );
}

function TestResult({ result }: { result: ConnectionTest }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityLiveRegion="polite" style={[styles.result, result.ok ? styles.resultOk : styles.resultBad]}>
      <Text style={[type.bodyStrong, { color: result.ok ? theme.successInk : '#a33' }]}>
        {result.ok ? `Connected in ${result.ms} ms` : 'Not connected'}
      </Text>
      <Text style={[type.body, { color: theme.ink }]}>
        {result.ok ? `The server, its database and the encrypted connection are all working.` : result.message}
      </Text>
    </View>
  );
}

function ServerForm() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { baseUrl, save, test } = useServer();
  const [address, setAddress] = useState(baseUrl.replace(/^http:\/\//, ''));
  const [result, setResult] = useState<ConnectionTest | null>(null);
  const [busy, setBusy] = useState(false);
  const { rootRef: keyboardRootRef, scrollRef: keyboardScrollRef, room: keyboardRoom, onScroll: onKeyboardScroll } = useKeyboardRoom<ScrollView>();

  const normalised = normaliseServerAddress(address);

  const runTest = async () => {
    setBusy(true);
    setResult(null);
    setResult(await test(address));
    setBusy(false);
  };

  const saveAndClose = async () => {
    await save(address);
    router.back();
  };

  return (
    <View ref={keyboardRootRef} style={{ flex: 1, paddingBottom: keyboardRoom, backgroundColor: theme.cream }}>
      <ScrollView
        ref={keyboardScrollRef}
        onScroll={onKeyboardScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[type.body, { color: theme.muted }]}>
          The laptop running the API, on the same Wi-Fi as this phone. Its address is shown at the end of the IIS
          setup script, or run <Text style={styles.code}>ipconfig</Text> on the laptop and use the Wi-Fi IPv4 address.
        </Text>

        <Text style={[type.bodyStrong, { color: theme.ink }]} nativeID="server-address-label">
          Server address
        </Text>
        <TextInput
          value={address}
          onChangeText={(v) => {
            setAddress(v);
            setResult(null);
          }}
          placeholder="192.168.1.14:5080"
          placeholderTextColor="#8f8b7e"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={runTest}
          accessibilityLabelledBy="server-address-label"
          style={styles.input}
        />
        <Text style={[type.caption, { color: theme.muted }]}>
          {normalised ? `Will connect to ${normalised}` : 'Type an IP address, optionally with :port (5080 if left out).'}
        </Text>

        <PressableScale onPress={runTest} disabled={!normalised || busy} style={styles.secondary}>
          {busy ? <ActivityIndicator color={theme.deep} /> : <Text style={styles.secondaryText}>Test connection</Text>}
        </PressableScale>

        {result && <TestResult result={result} />}

        <PressableScale
          onPress={saveAndClose}
          disabled={!normalised || !result?.ok}
          style={[styles.primary, { backgroundColor: theme.deep }]}
        >
          <Text style={styles.primaryText}>Save</Text>
        </PressableScale>
        {!!normalised && result && !result.ok && (
          <PressableScale onPress={saveAndClose} style={styles.link}>
            <Text style={[type.bodyStrong, { color: theme.deep }]}>Save anyway</Text>
          </PressableScale>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  code: { fontFamily: fonts.bodySemiBold, color: '#1B1B1B' },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#d8d4c8',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#1B1B1B',
    backgroundColor: '#fff',
  },
  secondary: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: theme.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: theme.deep },
  result: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  resultOk: { backgroundColor: 'rgba(99,153,34,0.15)' },
  resultBad: { backgroundColor: 'rgba(226,75,74,0.12)' },
  primary: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#F7F5EF' },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
});
