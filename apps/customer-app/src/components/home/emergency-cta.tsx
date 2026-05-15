import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, radius, spacing } from '@/theme/tokens';

export function EmergencyCta() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/book?emergency=1')}>
      <View
        style={{
          backgroundColor: '#fff1f2',
          borderRadius: radius.xl,
          padding: spacing[4],
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#fecdd3',
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#fee2e2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle color={colors.danger} size={20} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text variant="h3">Emergency repair</Text>
          <Text variant="caption" tone="muted">
            A technician within 60 minutes. Available 24x7.
          </Text>
        </View>
        <ChevronRight size={18} color={colors.inkSubtle} />
      </View>
    </Pressable>
  );
}
