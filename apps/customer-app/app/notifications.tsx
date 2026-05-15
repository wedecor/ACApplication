import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, BellRing } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import { track, Events } from '@/lib/analytics';
import { formatRelative } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

import type { NotificationItem } from '@/api/types';

const ICON_TONE: Record<NotificationItem['type'], string> = {
  BOOKING: colors.brand,
  PAYMENT: colors.accent,
  AMC: colors.brand,
  PROMO: colors.warn,
  SUPPORT: colors.inkMuted,
  SYSTEM: colors.inkMuted,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { data, isFetching, refetch } = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  function handleTap(notif: NotificationItem) {
    track(Events.NotificationOpen, { id: notif.id, type: notif.type });
    if (!notif.readAt) markOne.mutate(notif.id);
    const bookingId = notif.data?.bookingId;
    const invoiceId = notif.data?.invoiceId;
    if (bookingId) router.push(`/booking/${bookingId}`);
    else if (invoiceId) router.push(`/invoice/${invoiceId}`);
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <Text variant="h2">Notifications</Text>
        </View>
        {data && data.length > 0 ? (
          <Pressable onPress={() => markAll.mutate()} hitSlop={12}>
            <Text variant="caption" tone="brand" weight="600">
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ marginTop: spacing[4] }}>
        {(data?.length ?? 0) === 0 ? (
          <EmptyState
            title="You\u2019re all caught up"
            subtitle="Booking updates, payment receipts and AMC reminders will appear here."
            icon={<Bell size={26} />}
            action={
              <Button label="Book a service" onPress={() => router.push('/book')} />
            }
          />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(n) => n.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: spacing[3] }}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleTap(item)}>
                <Card
                  style={{
                    borderLeftWidth: item.readAt ? 0 : 4,
                    borderLeftColor: ICON_TONE[item.type],
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' }}>
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
                      <BellRing color={ICON_TONE[item.type]} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="h3">{item.title}</Text>
                      <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                        {item.body}
                      </Text>
                      <Text variant="micro" tone="subtle" style={{ marginTop: 4 }}>
                        {formatRelative(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
