import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { apiErrorMessage } from '../lib/api';
import { repairApi } from '../lib/repair-api';
import type { FaultCode } from '../lib/repair-types';
import { Button, colors, EmptyNote } from './ui';

/**
 * Searchable fault-code picker. Filtered by the booking's appliance
 * category + brand by default; "All brands" widens to the category (useful
 * for OEM-rebadged units).
 */
export function FaultCodePicker({
  visible,
  category,
  brand,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  category: string | null;
  brand: string | null;
  selected: string[];
  onToggle: (code: FaultCode) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [allBrands, setAllBrands] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const codes = useQuery({
    queryKey: ['fault-codes', category, allBrands ? null : brand, debounced],
    queryFn: () =>
      repairApi.faultCodes({ category, brand: allBrands ? null : brand, ...(debounced ? { q: debounced } : {}) }),
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: 48, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>Fault codes</Text>
          <Button small variant="outline" label="Done" onPress={onClose} />
        </View>
        <Text style={{ color: colors.muted }}>
          {category ?? 'Any category'}
          {!allBrands && brand ? ` · ${brand}` : ' · all brands'}
        </Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search code or description (e.g. E4, low gas)"
          accessibilityLabel="Search fault codes"
          placeholderTextColor={colors.subtle}
          autoCapitalize="characters"
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        {brand ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch value={allBrands} onValueChange={setAllBrands} />
            <Text>Show all brands</Text>
          </View>
        ) : null}
        {codes.isLoading ? (
          <ActivityIndicator />
        ) : codes.isError ? (
          <EmptyNote>Couldn&apos;t load fault codes: {apiErrorMessage(codes.error)}</EmptyNote>
        ) : (
          <FlatList
            data={codes.data ?? []}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<EmptyNote>No matching fault codes.</EmptyNote>}
            renderItem={({ item }) => {
              const isSelected = selected.includes(item.code);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => onToggle(item)}
                  style={{
                    backgroundColor: '#fff',
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.brand : colors.border,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontWeight: '800', color: isSelected ? colors.brand : colors.text }}>
                    {isSelected ? '✓ ' : ''}
                    {item.code} · {item.title}
                  </Text>
                  {item.brand ? <Text style={{ color: colors.subtle, fontSize: 12 }}>{item.brand}</Text> : null}
                  {item.suggestedFix ? (
                    <Text style={{ color: colors.muted }}>Fix: {item.suggestedFix}</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
