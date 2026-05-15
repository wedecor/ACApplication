import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Fingerprint,
  Gift,
  HelpCircle,
  LogOut,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  User2,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  getBiometricEnabled,
  isBiometricAvailable,
  requireBiometric,
  setBiometricEnabled,
} from '@/lib/biometric';
import { track, Events } from '@/lib/analytics';
import { useAuthStore } from '@/state/auth-store';
import { colors, spacing } from '@/theme/tokens';
import { initials } from '@/lib/format';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const logoutAll = useAuthStore((s) => s.logoutAll);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBio] = useState(false);

  useEffect(() => {
    (async () => {
      setBioAvailable(await isBiometricAvailable());
      setBio(await getBiometricEnabled());
    })();
  }, []);

  async function toggleBiometric(next: boolean) {
    if (next) {
      const ok = await requireBiometric('Enable biometric unlock');
      if (!ok) return;
    }
    await setBiometricEnabled(next);
    setBio(next);
  }

  return (
    <Screen>
      <Text variant="h1">Account</Text>
      <Card style={{ marginTop: spacing[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.brand50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="h1" tone="brand">
              {initials(profile?.fullName ?? profile?.phone ?? '?')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h2">{profile?.fullName ?? 'Add your name'}</Text>
            <Text variant="caption" tone="muted">
              {profile?.phone ?? profile?.email ?? '\u2014'}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/profile/edit')} hitSlop={12}>
            <Text variant="caption" tone="brand" weight="600">
              Edit
            </Text>
          </Pressable>
        </View>
      </Card>

      <Card padded={false} style={{ marginTop: spacing[4] }}>
        <ListRow
          title="Addresses"
          left={<RowIcon icon={<MapPin size={18} color={colors.brand} />} />}
          onPress={() => router.push('/profile/addresses')}
        />
        <Divider />
        <ListRow
          title="Payment methods"
          left={<RowIcon icon={<CreditCard size={18} color={colors.brand} />} />}
          onPress={() => router.push('/profile/payment-methods')}
        />
        <Divider />
        <ListRow
          title="Invoices"
          left={<RowIcon icon={<ReceiptText size={18} color={colors.brand} />} />}
          onPress={() => router.push('/(tabs)/invoices')}
        />
        <Divider />
        <ListRow
          title="AMC membership"
          left={<RowIcon icon={<ShieldCheck size={18} color={colors.brand} />} />}
          onPress={() => router.push('/(tabs)/amc')}
        />
      </Card>

      <Card padded={false} style={{ marginTop: spacing[3] }}>
        <ListRow
          title="Refer & earn"
          subtitle="Get \u20B9300 credit for every friend who books their first job."
          left={<RowIcon icon={<Gift size={18} color={colors.warn} />} />}
          onPress={() => router.push('/profile/referrals')}
        />
      </Card>

      <Card padded={false} style={{ marginTop: spacing[3] }}>
        <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
            <RowIcon icon={<Fingerprint size={18} color={colors.brand} />} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Biometric unlock</Text>
              <Text variant="caption" tone="muted">
                {bioAvailable
                  ? 'Use Face ID or fingerprint to open the app.'
                  : 'Not available on this device.'}
              </Text>
            </View>
            <Switch
              value={bioEnabled}
              onValueChange={toggleBiometric}
              disabled={!bioAvailable}
              trackColor={{ true: colors.brand, false: colors.border }}
            />
          </View>
        </View>
        <Divider />
        <ListRow
          title="Notification settings"
          left={<RowIcon icon={<Bell size={18} color={colors.brand} />} />}
          onPress={() => router.push('/profile/notifications')}
        />
        <Divider />
        <ListRow
          title="Devices & sessions"
          subtitle="Sign out of devices you no longer use."
          left={<RowIcon icon={<Smartphone size={18} color={colors.brand} />} />}
          onPress={() => router.push('/profile/devices')}
        />
      </Card>

      <Card padded={false} style={{ marginTop: spacing[3] }}>
        <ListRow
          title="Help & support"
          left={<RowIcon icon={<HelpCircle size={18} color={colors.brand} />} />}
          onPress={() => router.push('/support')}
        />
        <Divider />
        <ListRow
          title="About"
          left={<RowIcon icon={<User2 size={18} color={colors.brand} />} />}
          onPress={() => router.push('/profile/about')}
        />
      </Card>

      <Card padded={false} style={{ marginTop: spacing[3] }}>
        <ListRow
          title="Log out"
          left={<RowIcon icon={<LogOut size={18} color={colors.danger} />} />}
          onPress={() => {
            Alert.alert('Log out?', 'You can sign back in any time with your phone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                  track(Events.Logout);
                  await logout();
                },
              },
            ]);
          }}
        />
        <Divider />
        <ListRow
          title="Log out of all devices"
          left={<RowIcon icon={<LogOut size={18} color={colors.danger} />} />}
          onPress={() =>
            Alert.alert('Sign out everywhere?', 'You\u2019ll be signed out of every device.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out everywhere',
                style: 'destructive',
                onPress: () => logoutAll(),
              },
            ])
          }
          showChevron={false}
          right={<ChevronRight size={18} color={colors.danger} />}
        />
      </Card>

      <View style={{ alignItems: 'center', marginTop: spacing[6] }}>
        <Text variant="micro" tone="subtle">
          v0.1.0 \u2022 AC Platform
        </Text>
      </View>
    </Screen>
  );
}

function RowIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.brand50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </View>
  );
}
