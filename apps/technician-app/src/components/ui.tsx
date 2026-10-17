/**
 * Small shared building blocks for the field screens. Styling follows the
 * existing screens (white cards on #F5F7FA, brand green #0E7A4A, slate text)
 * and keeps touch targets ≥ 44pt for gloved / one-handed use.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

export const colors = {
  brand: '#0E7A4A',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  warning: '#92400E',
  warningBg: '#FEF3C7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  successBg: '#DCFCE7',
  info: '#1D4ED8',
  infoBg: '#DBEAFE',
};

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.card, padding: 16, borderRadius: 16, gap: 8 }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: colors.muted, textTransform: 'uppercase', fontSize: 12, fontWeight: '700' }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'warning' | 'danger';

const BUTTON_BG: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.brand },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  warning: { backgroundColor: colors.warning },
  danger: { backgroundColor: colors.danger },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  flex,
  disabled,
  loading,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  flex?: number;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  const isOutline = variant === 'outline';
  const inactive = disabled === true || loading === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[
        {
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 12 : 16,
          minHeight: small ? 36 : 48,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        BUTTON_BG[variant],
        flex ? { flex } : null,
        inactive ? { opacity: 0.55 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.text : '#fff'} />
      ) : (
        <Text style={{ color: isOutline ? colors.text : '#fff', fontWeight: '700' }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: selected ? colors.successBg : '#fff',
      }}
    >
      <Text style={{ color: selected ? colors.brand : colors.text, fontWeight: selected ? '700' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const palette = {
    neutral: { bg: '#F1F5F9', fg: colors.muted },
    success: { bg: colors.successBg, fg: colors.brand },
    warning: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    info: { bg: colors.infoBg, fg: colors.info },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: '600', color: colors.text }}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.subtle}
        {...input}
        style={[
          {
            backgroundColor: '#fff',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.text,
            minHeight: input.multiline ? 72 : 44,
            textAlignVertical: input.multiline ? 'top' : 'center',
          },
          input.style,
        ]}
      />
      {hint ? <Text style={{ color: colors.muted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

/** Explicit Yes / No (unanswered is distinct from "No" for checklists). */
export function YesNo({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  const opt = (v: boolean, label: string) => {
    const active = value === v;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(active ? undefined : v)}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          minWidth: 56,
          alignItems: 'center',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: active ? (v ? colors.brand : colors.danger) : colors.border,
          backgroundColor: active ? (v ? colors.successBg : colors.dangerBg) : '#fff',
        }}
      >
        <Text style={{ fontWeight: '700', color: active ? (v ? colors.brand : colors.danger) : colors.muted }}>
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {opt(true, 'Yes')}
      {opt(false, 'No')}
    </View>
  );
}

export function Banner({
  tone,
  title,
  body,
}: {
  tone: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  body?: string;
}) {
  const palette = {
    warning: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    info: { bg: colors.infoBg, fg: colors.info },
    success: { bg: colors.successBg, fg: colors.brand },
  }[tone];
  return (
    <View style={{ backgroundColor: palette.bg, padding: 12, borderRadius: 12, gap: 2 }}>
      <Text style={{ color: palette.fg, fontWeight: '800' }}>{title}</Text>
      {body ? <Text style={{ color: palette.fg }}>{body}</Text> : null}
    </View>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.muted, fontStyle: 'italic' }}>{children}</Text>;
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={{ color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}
