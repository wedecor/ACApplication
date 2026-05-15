import { View } from 'react-native';

import { colors } from '@/theme/tokens';

export function Divider({ vertical = false, color = colors.border }: { vertical?: boolean; color?: string }) {
  return (
    <View
      style={
        vertical
          ? { width: 1, alignSelf: 'stretch', backgroundColor: color }
          : { height: 1, backgroundColor: color, marginVertical: 12 }
      }
    />
  );
}
