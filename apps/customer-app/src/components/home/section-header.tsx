import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/theme/tokens';

interface Props {
  title: string;
  trailing?: React.ReactNode;
}

export function SectionHeader({ title, trailing }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing[6],
        marginBottom: spacing[3],
      }}
    >
      <Text variant="h2">{title}</Text>
      {trailing}
    </View>
  );
}
