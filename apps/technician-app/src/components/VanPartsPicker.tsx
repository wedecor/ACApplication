import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { getTechnicianId } from '../lib/auth';
import { inventoryApi, type VanInventoryRow } from '../lib/inventory-api';
import { formatMinor } from '../lib/money';
import { Button, colors, EmptyNote } from './ui';

export function useTechnicianId(): string | null {
  const [techId, setTechId] = useState<string | null>(null);
  useEffect(() => {
    void getTechnicianId().then(setTechId);
  }, []);
  return techId;
}

/** Same query key as the van inventory screen so the cache is shared. */
export function useVanInventory() {
  const techId = useTechnicianId();
  return useQuery({
    queryKey: ['van-inventory', techId],
    queryFn: () => inventoryApi.vanInventory(techId!),
    enabled: !!techId,
  });
}

export function VanPartsPicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (row: VanInventoryRow) => void;
  onClose: () => void;
}) {
  const van = useVanInventory();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (van.data ?? [])
      .filter((r) => r.remainingQty > 0)
      .filter(
        (r) =>
          !needle || r.item.name.toLowerCase().includes(needle) || r.item.sku.toLowerCase().includes(needle),
      );
  }, [van.data, q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: 48, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>Parts in your van</Text>
          <Button small variant="outline" label="Close" onPress={onClose} />
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name or SKU"
          placeholderTextColor={colors.subtle}
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        {van.isLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<EmptyNote>No stock on hand matches.</EmptyNote>}
            renderItem={({ item: r }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => onPick(r)}
                style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, gap: 2 }}
              >
                <Text style={{ fontWeight: '700' }}>{r.item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {r.item.sku} · {r.remainingQty} {r.item.unit.toLowerCase()} left ·{' '}
                  {formatMinor(r.item.sellingPriceMinor)}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
