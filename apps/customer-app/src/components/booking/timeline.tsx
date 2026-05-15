import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

import type { BookingDetail } from '@/api/types';

const LABEL: Record<BookingDetail['timeline'][number]['status'], string> = {
  CREATED: 'Booking created',
  CONFIRMED: 'Booking confirmed',
  ASSIGNED: 'Technician assigned',
  EN_ROUTE: 'Technician on the way',
  ARRIVED: 'Technician arrived',
  IN_PROGRESS: 'Service in progress',
  AWAITING_PARTS: 'Awaiting parts',
  COMPLETED: 'Service completed',
  CANCELLED: 'Booking cancelled',
  NO_SHOW: 'Marked as no-show',
};

interface Props {
  timeline: BookingDetail['timeline'];
}

export function Timeline({ timeline }: Props) {
  if (!timeline.length) return null;
  return (
    <View style={{ gap: spacing[3] }}>
      {timeline.map((step, idx) => (
        <View key={`${step.status}-${idx}`} style={{ flexDirection: 'row' }}>
          <View style={{ alignItems: 'center', width: 20 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: idx === 0 ? colors.brand : colors.border,
              }}
            />
            {idx < timeline.length - 1 ? (
              <View
                style={{
                  width: 2,
                  flex: 1,
                  backgroundColor: colors.border,
                  marginTop: 2,
                }}
              />
            ) : null}
          </View>
          <View style={{ marginLeft: spacing[3], flex: 1, paddingBottom: spacing[2] }}>
            <Text variant="h3">{LABEL[step.status] ?? step.status}</Text>
            <Text variant="caption" tone="muted">
              {formatDateTime(step.at)}
            </Text>
            {step.note ? (
              <Text variant="caption" tone="subtle" style={{ marginTop: 2 }}>
                {step.note}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
