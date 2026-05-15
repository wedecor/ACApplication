import { useQuery } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react-native';
import { Alert, Pressable, View } from 'react-native';

import { profileApi } from '@/api/endpoints';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import { requireBiometric } from '@/lib/biometric';
import { formatRelative } from '@/lib/format';
import { useAuthStore } from '@/state/auth-store';
import { colors, spacing } from '@/theme/tokens';

export default function DevicesScreen() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => profileApi.me() });
  const logoutAll = useAuthStore((s) => s.logoutAll);
  return (
    <Screen padded>
      <SubHeader title="Devices & sessions" />
      <Text variant="body" tone="muted" style={{ marginTop: spacing[2] }}>
        Anything that doesn\u2019t look like yours? Revoke it instantly.
      </Text>

      <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
        {me.isLoading ? (
          <Card>
            <Skeleton width="40%" />
            <Skeleton width="80%" style={{ marginTop: 8 }} />
          </Card>
        ) : (me.data?.devices?.length ?? 0) === 0 ? (
          <EmptyState
            title="No active sessions"
            subtitle="Sign in again to see this device listed here."
            icon={<Smartphone size={26} />}
          />
        ) : (
          (me.data?.devices ?? []).map((d) => (
            <Card key={d.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="h3">{d.modelName ?? d.deviceId.slice(0, 8)}</Text>
                {d.current ? <Badge tone="success" label="This device" small /> : null}
              </View>
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                Last active {formatRelative(d.lastSeenAt)}
              </Text>
              {!d.current ? (
                <Pressable
                  onPress={async () => {
                    if (!(await requireBiometric('Confirm to sign out the device'))) return;
                    try {
                      await profileApi.revokeDevice(d.id);
                      me.refetch();
                    } catch (err) {
                      Alert.alert('Failed', err instanceof Error ? err.message : 'Try again.');
                    }
                  }}
                  style={{ marginTop: spacing[2] }}
                >
                  <Text variant="caption" tone="danger" weight="600">
                    Sign out from this device
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          ))
        )}
      </View>

      <Pressable
        onPress={() =>
          Alert.alert('Sign out everywhere?', 'You\u2019ll need to sign in again on every device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out everywhere', style: 'destructive', onPress: () => logoutAll() },
          ])
        }
        style={{ alignItems: 'center', marginTop: spacing[6] }}
      >
        <Text variant="body" tone="danger" weight="600">
          Sign out from all devices
        </Text>
      </Pressable>
      <View style={{ alignItems: 'center', marginTop: spacing[2] }}>
        <Text variant="caption" tone="subtle" style={{ textAlign: 'center', maxWidth: 320 }}>
          Recommended if your phone was lost or stolen. New logins will require an OTP.
        </Text>
      </View>
      <View style={{ height: spacing[2] }} />
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
          <Text variant="micro" tone="muted">
            End-to-end secured by per-device refresh tokens.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
