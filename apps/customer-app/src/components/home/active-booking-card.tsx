import { useRouter } from 'expo-router';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useRealtimeConnected } from '@/hooks/use-realtime';
import { formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

import type { BookingSummary } from '@/api/types';

const STATUS_TONE: Record<BookingSummary['status'], 'neutral' | 'brand' | 'success' | 'warn' | 'danger'> = {
  CREATED: 'neutral',
  CONFIRMED: 'brand',
  ASSIGNED: 'brand',
  EN_ROUTE: 'warn',
  ARRIVED: 'success',
  IN_PROGRESS: 'success',
  AWAITING_PARTS: 'warn',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

const STATUS_LABEL: Record<BookingSummary['status'], string> = {
  CREATED: 'Booked',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Pro assigned',
  EN_ROUTE: 'On the way',
  ARRIVED: 'Arrived',
  IN_PROGRESS: 'In progress',
  AWAITING_PARTS: 'Awaiting parts',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

interface Props {
  booking: BookingSummary;
}

export function ActiveBookingCard({ booking }: Props) {
  const router = useRouter();
  const live = useRealtimeConnected();
  return (
    <Pressable onPress={() => router.push(`/booking/${booking.id}`)}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Badge tone={STATUS_TONE[booking.status]} label={STATUS_LABEL[booking.status]} />
            {live && booking.status === 'EN_ROUTE' ? <LiveDot /> : null}
          </View>
          <ChevronRight size={18} color={colors.inkSubtle} />
        </View>
        <Text variant="h2" style={{ marginTop: spacing[3] }}>
          {booking.applianceLabel}
        </Text>
        <Text variant="caption" tone="muted">
          {booking.issueLabel}
        </Text>
        <View
          style={{
            marginTop: spacing[3],
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <MapPin size={14} color={colors.inkSubtle} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {booking.address?.line1 ?? 'Address on file'} \u2022 {formatDateTime(booking.scheduledAt)}
          </Text>
        </View>
        {booking.technician ? (
          <View style={{ marginTop: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.brand50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="caption" tone="brand" weight="700">
                {booking.technician.fullName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              {booking.technician.fullName} {booking.technician.rating ? `\u2605 ${booking.technician.rating.toFixed(1)}` : ''}
            </Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function LiveDot() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.accent,
        }}
      />
      <Text variant="micro" weight="700" style={{ color: colors.accent }}>
        LIVE
      </Text>
    </View>
  );
}
