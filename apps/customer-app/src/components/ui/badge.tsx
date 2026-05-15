import { View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger';

const COLORS: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#eef2f7', fg: colors.inkMuted },
  brand: { bg: colors.brand50, fg: colors.brand700 },
  success: { bg: '#dcfce7', fg: '#166534' },
  warn: { bg: '#fef3c7', fg: '#92400e' },
  danger: { bg: '#fee2e2', fg: '#991b1b' },
};

interface Props {
  label: string;
  tone?: Tone;
  small?: boolean;
}

export function Badge({ label, tone = 'neutral', small }: Props) {
  const c = COLORS[tone];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: small ? 6 : spacing[2],
        paddingVertical: small ? 2 : 4,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
      }}
    >
      <Text variant={small ? 'micro' : 'caption'} style={{ color: c.fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}
