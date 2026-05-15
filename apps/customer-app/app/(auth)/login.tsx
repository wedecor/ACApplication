import { useRouter } from 'expo-router';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api-client';
import { track, Events } from '@/lib/analytics';
import { useAuthStore } from '@/state/auth-store';
import { colors, spacing } from '@/theme/tokens';

const PHONE_REGEX = /^[6-9]\d{9}$/;

export default function LoginScreen() {
  const router = useRouter();
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = PHONE_REGEX.test(phone);

  async function onContinue() {
    if (!valid) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestOtp({ destination: `+91${phone}`, channel });
      track(Events.LoginRequest, { channel });
      router.push('/(auth)/verify');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Could not send OTP', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'space-between' }}
      >
        <View style={{ marginTop: spacing[6] }}>
          <Text variant="display">Sign in</Text>
          <Text variant="body" tone="muted" style={{ marginTop: spacing[2] }}>
            We\u2019ll send you a one-time password to verify your number.
          </Text>
          <View style={{ marginTop: spacing[6] }}>
            <Input
              label="Mobile number"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={10}
              value={phone}
              onChangeText={(v) => {
                setError(null);
                setPhone(v.replace(/[^\d]/g, ''));
              }}
              error={error ?? undefined}
              leftAdornment={
                <View
                  style={{
                    paddingRight: spacing[2],
                    borderRightWidth: 1,
                    borderRightColor: colors.border,
                  }}
                >
                  <Text variant="body" weight="600">
                    +91
                  </Text>
                </View>
              }
              placeholder="98765 43210"
            />
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
              <ChannelChip
                active={channel === 'sms'}
                icon={<Phone size={14} color={channel === 'sms' ? colors.brand : colors.inkMuted} />}
                label="SMS"
                onPress={() => setChannel('sms')}
              />
              <ChannelChip
                active={channel === 'whatsapp'}
                icon={
                  <MessageCircle
                    size={14}
                    color={channel === 'whatsapp' ? colors.brand : colors.inkMuted}
                  />
                }
                label="WhatsApp"
                onPress={() => setChannel('whatsapp')}
              />
            </View>
          </View>
        </View>
        <Button
          label="Send OTP"
          rightIcon={<ArrowRight color="#fff" size={18} />}
          fullWidth
          size="lg"
          loading={loading}
          disabled={!valid}
          onPress={onContinue}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ChannelChip({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      leftIcon={icon}
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      onPress={onPress}
      haptic={false}
    />
  );
}
