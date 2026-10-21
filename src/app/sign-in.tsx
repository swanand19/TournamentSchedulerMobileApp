import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { SendOtpResponse, VerifyOtpResponse } from '@/api/types';
import { saveSession, useSessionState } from '@/auth/session';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import PitchBackground from '@/components/PitchBackground';
import PressableScale from '@/components/PressableScale';
import TextField from '@/components/TextField';
import { useServer } from '@/config/server';
import { useAction } from '@/hooks/useAction';
import { useAuthOptions } from '@/hooks/useAuthOptions';
import { formatPhone } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { fonts, footballTheme as theme, radius, space, type } from '@/theme/theme';

// Sign in and sign up are one flow: email or mobile number → the 6-digit code we send → (new ones
// only) a name. There is no password. The server decides everything — whether it's an email or a
// number, whether it's new, how many tries are left, how long to wait for another code — and its
// messages are shown as they come. Mobile numbers are offered only once the server can text codes.

type Step = 'contact' | 'code' | 'name';

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, baseUrl } = useServer();
  const { signedOutReason } = useSessionState();
  const action = useAction();
  const options = useAuthOptions();

  const [step, setStep] = useState<Step>('contact');
  // What was typed; once a code is sent, the email or number as the server stored it.
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<SendOtpResponse['channel']>('Email');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // A countdown for "Send a new code", only while it matters.
  useEffect(() => {
    if (step !== 'code' || now >= resendAt) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [step, now, resendAt]);

  const sendCode = async () => {
    const res = await action.run(() => api.call<SendOtpResponse>('AUTH_OTP_SEND', { body: { contact: contact.trim() } }));
    if (!res.ok) return;
    setContact(res.value.sentTo);
    setChannel(res.value.channel);
    setCode('');
    setResendAt(Date.now() + res.value.resendAfterSeconds * 1000);
    setNow(Date.now());
    setStep('code');
  };

  const verify = async (withName?: string) => {
    const res = await action.run(() =>
      api.call<VerifyOtpResponse>('AUTH_OTP_VERIFY', {
        body: { contact, otp: code.replace(/\s/g, ''), name: withName ?? null },
      }),
    );
    if (!res.ok) return;
    const result = res.value;
    if (result.outcome === 'NeedsName') {
      setStep('name');
      return;
    }
    haptic.success();
    // The root layout swaps to the tournaments as soon as the session is set.
    await saveSession({
      server: baseUrl,
      token: result.sessionToken!,
      sessionId: result.sessionId!,
      expiresAt: result.expiresAt!,
      user: result.user!,
    });
  };

  const texted = channel === 'Sms';
  const shown = texted ? formatPhone(contact) : contact;
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const error = action.error?.message ?? (step === 'contact' ? signedOutReason : '');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PitchBackground theme={theme} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.eyebrow, { color: theme.accent }]}>Matchday scheduler</Text>
            <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
              {step === 'name' ? 'Welcome' : 'Sign in'}
            </Text>
          </View>
          <PressableScale
            onPress={() => router.push('/server')}
            style={[styles.serverChip, { borderColor: theme.borderOnDark, backgroundColor: theme.deck }]}
            accessibilityLabel={`Server ${baseUrl || 'not set'}. Change server`}
          >
            <Text style={[styles.serverText, { color: theme.onDark }]}>Server</Text>
          </PressableScale>
        </View>

        <ErrorBanner
          message={error}
          actionLabel={action.error instanceof NetworkError ? 'Change server' : undefined}
          onAction={action.error instanceof NetworkError ? () => router.push('/server') : undefined}
        />

        <Card>
          {step === 'contact' && (
            <>
              <TextField
                label={options.phone ? 'Email or mobile number' : 'Your email'}
                value={contact}
                onChangeText={setContact}
                placeholder={options.phone ? 'you@example.com or 98765 43210' : 'you@example.com'}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={options.phone ? 'username' : 'email'}
                textContentType={options.phone ? 'username' : 'emailAddress'}
                returnKeyType="send"
                onSubmitEditing={sendCode}
                editable={!action.busy}
                hint={
                  options.phone
                    ? "We'll send a 6-digit code by email or text message. New here? The same code creates your account."
                    : "We'll email you a 6-digit code. New here? The same code creates your account."
                }
              />
              <Button label="Send code" icon={options.phone ? 'send-outline' : 'email-fast-outline'} onPress={sendCode} busy={action.busy} disabled={!ready} size="lg" />
            </>
          )}

          {step === 'code' && (
            <>
              <TextField
                label={`Code sent to ${shown}`}
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^\d\s]/g, ''))}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete={texted ? 'sms-otp' : 'one-time-code'}
                textContentType="oneTimeCode"
                maxLength={7}
                returnKeyType="done"
                onSubmitEditing={() => verify()}
                editable={!action.busy}
                autoFocus
                hint={texted ? 'It works for 5 minutes. A text can take a minute to arrive.' : "It works for 5 minutes. Check your spam folder if it hasn't arrived."}
              />
              <Button label="Sign in" icon="login" onPress={() => verify()} busy={action.busy} size="lg" />
              <View style={styles.links}>
                <PressableScale
                  onPress={() => {
                    action.clearError();
                    setStep('contact');
                  }}
                  disabled={action.busy}
                  style={styles.link}
                >
                  <Text style={[type.bodyStrong, { color: theme.deep }]}>{texted ? 'Different number' : 'Different email'}</Text>
                </PressableScale>
                <PressableScale onPress={sendCode} disabled={action.busy || waitSeconds > 0} style={styles.link}>
                  <Text style={[type.bodyStrong, { color: waitSeconds > 0 ? theme.muted : theme.deep }]}>
                    {waitSeconds > 0 ? `New code in ${waitSeconds}s` : 'Send a new code'}
                  </Text>
                </PressableScale>
              </View>
            </>
          )}

          {step === 'name' && (
            <>
              <TextField
                label="Your name"
                value={name}
                onChangeText={setName}
                placeholder="As teammates know you"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={() => verify(name.trim())}
                editable={!action.busy}
                autoFocus
                hint={`${shown} is new here — this creates your account.`}
              />
              <Button label="Create account" icon="account-plus-outline" onPress={() => verify(name.trim())} busy={action.busy} size="lg" />
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  serverChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 44, justifyContent: 'center' },
  serverText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.xs },
});
