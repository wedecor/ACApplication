import { forwardRef, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, leftAdornment, rightAdornment, style, ...rest },
  ref,
) {
  return (
    <View>
      {label ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {leftAdornment ? <View style={{ marginRight: spacing[2] }}>{leftAdornment}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkSubtle}
          style={[
            {
              flex: 1,
              color: colors.ink,
              fontSize: 15,
              paddingVertical: 0,
            },
            style,
          ]}
          {...rest}
        />
        {rightAdornment ? <View style={{ marginLeft: spacing[2] }}>{rightAdornment}</View> : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    minHeight: 48,
  },
});
