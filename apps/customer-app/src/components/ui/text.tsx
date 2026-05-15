import { Text as RNText, type TextProps } from 'react-native';

import { colors, typography } from '@/theme/tokens';

type Variant = keyof typeof typography;

type Tone = 'default' | 'muted' | 'subtle' | 'brand' | 'danger' | 'accent' | 'inverse';

const TONE_COLOR: Record<Tone, string> = {
  default: colors.ink,
  muted: colors.inkMuted,
  subtle: colors.inkSubtle,
  brand: colors.brand,
  danger: colors.danger,
  accent: colors.accent,
  inverse: colors.white,
};

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700' | '800';
}

export function Text({ variant = 'body', tone = 'default', weight, style, ...rest }: Props) {
  const base = typography[variant];
  return (
    <RNText
      {...rest}
      style={[base, { color: TONE_COLOR[tone] }, weight ? { fontWeight: weight } : null, style]}
    />
  );
}
