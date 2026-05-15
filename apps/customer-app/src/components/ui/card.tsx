import { View, type ViewProps } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme/tokens';

interface Props extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ padded = true, elevated = true, style, children, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: padded ? spacing[4] : 0,
          borderColor: colors.border,
          borderWidth: elevated ? 0 : 1,
        },
        elevated ? shadow.sm : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
