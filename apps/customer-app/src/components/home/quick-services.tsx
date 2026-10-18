import { useRouter } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { APPLIANCES } from '@/content/appliances';
import { formatRupeesShort } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';
import { ApplianceIcon } from '@/components/appliance-icon';

export function QuickServices() {
  const router = useRouter();
  return (
    <FlatList
      horizontal
      data={APPLIANCES}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing[3], paddingVertical: 2 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/book?appliance=${item.id}`)}
          accessibilityLabel={`Book ${item.name}`}
        >
          <Card padded={false} style={{ width: 140, padding: spacing[4] }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.brand50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ApplianceIcon category={item.category} />
            </View>
            <Text variant="h3" style={{ marginTop: spacing[3] }} numberOfLines={2}>
              {item.name}
            </Text>
            <Text variant="caption" tone="muted">
              From {formatRupeesShort(item.estStartingMinor)}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
