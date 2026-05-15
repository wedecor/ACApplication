import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { STEP_ORDER, type BookingStep } from '@/state/booking-draft';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  active: BookingStep;
}

const LABELS: Record<BookingStep, string> = {
  service: 'Service',
  issue: 'Issue',
  photos: 'Photos',
  schedule: 'Schedule',
  address: 'Address',
  review: 'Review',
};

export function StepPills({ active }: Props) {
  const activeIndex = STEP_ORDER.indexOf(active);
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing[3] }}>
        {STEP_ORDER.map((s, i) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= activeIndex ? colors.brand : colors.border,
            }}
          />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        Step {activeIndex + 1} of {STEP_ORDER.length} \u2022 {LABELS[active]}
      </Text>
    </View>
  );
}
