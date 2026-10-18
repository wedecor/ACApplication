import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, type TextInput, View } from 'react-native';

import { Button, colors, Field } from '../src/components/ui';
import { apiErrorMessage, apiStatus } from '../src/lib/api';
import { requestLoginOtp, signIn, toE164 } from '../src/lib/session-api';

/**
 * Technician sign-in: phone number → one-time code. The session is only
 * stored once the API confirms the number belongs to a technician profile.
 */
export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<TextInput>(null);

  async function sendCode() {
    const normalised = toE164(phone);
    if (!normalised) {
      setError('Enter the 10-digit mobile number registered with your branch.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestLoginOtp(normalised);
      setE164(normalised);
      setSentTo(res.sentTo);
      if (res.devCode) setCode(res.devCode);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(apiStatus(err) === 429 ? 'Too many attempts. Wait a minute and try again.' : apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!e164) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(e164, code.trim());
      router.replace('/');
    } catch (err) {
      const status = apiStatus(err);
      setError(
        status === 401
          ? 'That code is wrong or has expired. Check the SMS or send a new one.'
          : status === 404
            ? 'This number isn’t linked to a technician account. Ask your branch admin to add you.'
            : apiErrorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Sign in', headerBackVisible: false }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6, marginTop: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
            {e164 ? 'Enter your code' : 'Start your shift'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
            {e164
              ? `We sent a one-time code to ${sentTo}.`
              : 'Sign in with the mobile number your branch registered for you.'}
          </Text>
        </View>

        {e164 ? (
          <>
            <Field
              ref={codeRef}
              label="One-time code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={8}
              onSubmitEditing={() => void verify()}
            />
            {error ? <ErrorText message={error} /> : null}
            <Button label="Sign in" onPress={() => void verify()} loading={busy} disabled={code.trim().length < 4} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <LinkButton
                label="Change number"
                onPress={() => {
                  setE164(null);
                  setCode('');
                  setError(null);
                }}
              />
              <LinkButton label="Send a new code" onPress={() => void sendCode()} disabled={busy} />
            </View>
          </>
        ) : (
          <>
            <Field
              label="Mobile number"
              placeholder="98765 43210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              onSubmitEditing={() => void sendCode()}
            />
            {error ? <ErrorText message={error} /> : null}
            <Button label="Send code" onPress={() => void sendCode()} loading={busy} disabled={phone.trim().length < 10} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, lineHeight: 20 }}>
      {message}
    </Text>
  );
}

function LinkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: colors.brand, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
