import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  title: string;
  trailing?: ReactNode;
  onBack?: () => void;
}

export function SubHeader({ title, trailing, onBack }: Props) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing[2],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Pressable
          onPress={() => (onBack ? onBack() : router.back())}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Text variant="h2">{title}</Text>
      </View>
      {trailing}
    </View>
  );
}
