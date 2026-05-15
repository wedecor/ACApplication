import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';

type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLES: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.brand, fg: colors.white },
  secondary: { bg: colors.brand50, fg: colors.brand700 },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.brand },
  danger: { bg: colors.danger, fg: colors.white },
  accent: { bg: colors.accent, fg: colors.white },
};

const SIZE_STYLES: Record<Size, { paddingV: number; paddingH: number; font: number }> = {
  sm: { paddingV: 8, paddingH: 14, font: 13 },
  md: { paddingV: 12, paddingH: 18, font: 15 },
  lg: { paddingV: 16, paddingH: 22, font: 16 },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  fullWidth,
  haptic = true,
  disabled,
  onPress,
  style,
  ...rest
}: Props) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      onPress={(e) => {
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        onPress?.(e);
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : undefined,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {leftIcon ? <View style={{ marginRight: spacing[2] }}>{leftIcon}</View> : null}
            <Text style={{ color: v.fg, fontWeight: '700', fontSize: s.font }}>{label}</Text>
            {rightIcon ? <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
