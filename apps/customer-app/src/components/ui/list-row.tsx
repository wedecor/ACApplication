import { ChevronRight } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { Text } from './text';

interface Props {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}

export function ListRow({ title, subtitle, left, right, onPress, showChevron = true }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        flexDirection: 'row',
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {left ? <View style={{ marginRight: spacing[3] }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && showChevron ? (
        <ChevronRight size={18} color={colors.inkSubtle} style={{ marginLeft: spacing[2] }} />
      ) : null}
    </Pressable>
  );
}
