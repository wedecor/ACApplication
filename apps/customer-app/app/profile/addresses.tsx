import { Pencil, Star, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import {
  useAddresses,
  useDeleteAddress,
  useSetDefaultAddress,
} from '@/hooks/use-addresses';
import { colors, spacing } from '@/theme/tokens';

export default function AddressesScreen() {
  const list = useAddresses();
  const setDefault = useSetDefaultAddress();
  const remove = useDeleteAddress();
  return (
    <Screen padded>
      <SubHeader title="Saved addresses" />
      <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
        {(list.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No addresses yet"
            subtitle="Add an address during your next booking to save time later."
          />
        ) : (
          (list.data ?? []).map((a) => (
            <Card key={a.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="h3">{a.label}</Text>
                {a.isDefault ? <Badge tone="brand" label="Default" small /> : null}
              </View>
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ')}
              </Text>
              {a.landmark ? (
                <Text variant="caption" tone="subtle" style={{ marginTop: 2 }}>
                  Near {a.landmark}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                {!a.isDefault ? (
                  <Pressable onPress={() => setDefault.mutate(a.id)}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Star size={14} color={colors.brand} />
                      <Text variant="caption" tone="brand" weight="600">
                        Set as default
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete address?', a.line1, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => remove.mutate(a.id),
                      },
                    ])
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={14} color={colors.danger} />
                  <Text variant="caption" tone="danger" weight="600">
                    Delete
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </View>
      <Button
        label="Add new address"
        variant="outline"
        fullWidth
        leftIcon={<Pencil size={16} color={colors.ink} />}
        onPress={() => {
          // Re-use the add-address flow inside the booking screen.
          // Quick win for now; richer geocoded picker can replace this later.
        }}
        style={{ marginTop: spacing[4] }}
      />
    </Screen>
  );
}
