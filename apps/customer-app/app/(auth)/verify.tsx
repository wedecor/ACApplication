import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api-client';
import { track, Events } from '@/lib/analytics';
import { useAuthStore } from '@/state/auth-store';
import { colors, radius, spacing } from '@/theme/tokens';

const LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resend = useAuthStore((s) => s.resend);
  const sentTo = useAuthStore((s) => s.pendingMaskedTo);
  const pendingDestination = useAuthStore((s) => s.pendingDestination);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (!pendingDestination) {
      router.replace('/(auth)/login');
    }
  }, [pendingDestination, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1_000);
    return () => clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  async function submit(value: string = code) {
    if (value.length !== LENGTH) return;
    setLoading(true);
    try {
      track(Events.LoginVerify);
      await verifyOtp(value);
      track(Events.LoginSuccess);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not verify. Please try again.';
      Alert.alert('Invalid OTP', message);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    try {
      await resend();
      setResendIn(30);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not resend. Please try again later.';
      Alert.alert('Resend failed', message);
    }
  }

  return (
    <Screen padded scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'space-between' }}
      >
        <View style={{ marginTop: spacing[6] }}>
          <Text variant="display">Enter OTP</Text>
          <Text variant="body" tone="muted" style={{ marginTop: spacing[2] }}>
            Sent to {sentTo ?? pendingDestination ?? 'your phone'}.{' '}
            <Text
              variant="body"
              tone="brand"
              onPress={() => router.back()}
              weight="600"
            >
              Change
            </Text>
          </Text>
          <Pressable onPress={() => ref.current?.focus()}>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[6] }}>
              {Array.from({ length: LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.cell,
                    { borderColor: i === code.length ? colors.brand : colors.border },
                  ]}
                >
                  <Text variant="h1">{code[i] ?? ''}</Text>
                </View>
              ))}
            </View>
          </Pressable>
          <TextInput
            ref={ref}
            value={code}
            onChangeText={(v) => {
              const next = v.replace(/[^\d]/g, '').slice(0, LENGTH);
              setCode(next);
              if (next.length === LENGTH) {
                void submit(next);
              }
            }}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            style={styles.hiddenInput}
            caretHidden
            maxLength={LENGTH}
          />
          <View style={{ marginTop: spacing[5], flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="caption" tone="muted">
              Didn\u2019t get the code?{' '}
            </Text>
            {resendIn > 0 ? (
              <Text variant="caption" tone="subtle">
                Resend in {resendIn}s
              </Text>
            ) : (
              <Text variant="caption" tone="brand" weight="600" onPress={onResend}>
                Resend now
              </Text>
            )}
          </View>
        </View>
        <Button
          label="Verify & Continue"
          fullWidth
          size="lg"
          loading={loading}
          disabled={code.length !== LENGTH}
          onPress={() => submit()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
});
