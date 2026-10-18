import { View } from 'react-native';

import { colors } from '@/theme/tokens';

/** Hairline rule. `flush` drops the vertical margin for use between list rows that carry their own padding. */
export function Divider({
  vertical = false,
  flush = false,
  color = colors.border,
}: {
  vertical?: boolean;
  flush?: boolean;
  color?: string;
}) {
  return (
    <View
      style={
        vertical
          ? { width: 1, alignSelf: 'stretch', backgroundColor: color }
          : { height: 1, backgroundColor: color, marginVertical: flush ? 0 : 12 }
      }
    />
  );
}
