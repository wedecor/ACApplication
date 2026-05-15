import { useRouter } from 'expo-router';
import { CalendarPlus } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useBookings } from '@/hooks/use-bookings';
import { formatDateTime, formatRupees } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

import type { BookingSummary } from '@/api/types';

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function BookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('active');
  const { data, isLoading, isFetching, refetch } = useBookings(tab);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
    >
      <Text variant="h1">My bookings</Text>
      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: tab === t.id ? colors.brand : colors.surface,
              borderWidth: 1,
              borderColor: tab === t.id ? colors.brand : colors.border,
            }}
          >
            <Text variant="caption" weight="600" tone={tab === t.id ? 'inverse' : 'default'}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: spacing[4] }}>
        {isLoading ? (
          <View style={{ gap: spacing[3] }}>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Nothing here yet"
            subtitle="When you book a service it shows up here with live status and a one-tap re-book."
            action={
              <Button
                label="Book a service"
                leftIcon={<CalendarPlus size={16} color="#fff" />}
                onPress={() => router.push('/book')}
              />
            }
          />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(b) => b.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: spacing[3] }}
            renderItem={({ item }) => (
              <BookingRow item={item} onPress={() => router.push(`/booking/${item.id}`)} />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

function BookingRow({ item, onPress }: { item: BookingSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Badge
            tone={
              item.status === 'COMPLETED'
                ? 'success'
                : item.status === 'CANCELLED' || item.status === 'NO_SHOW'
                  ? 'danger'
                  : 'brand'
            }
            label={item.status.replace('_', ' ').toLowerCase()}
          />
          <Text variant="caption" tone="subtle">
            #{item.code}
          </Text>
        </View>
        <Text variant="h3" style={{ marginTop: spacing[2] }}>
          {item.applianceLabel}
        </Text>
        <Text variant="caption" tone="muted">
          {item.issueLabel} \u2022 {formatDateTime(item.scheduledAt)}
        </Text>
        {item.amountMinor != null ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
            {formatRupees(item.amountMinor)} paid
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

function SkeletonRow() {
  return (
    <Card>
      <Skeleton width="40%" />
      <Skeleton width="80%" style={{ marginTop: 8 }} />
      <Skeleton width="60%" style={{ marginTop: 8 }} />
    </Card>
  );
}
