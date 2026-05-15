import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { inventoryApi, type InventoryItemLookup } from '../../src/lib/inventory-api';

/**
 * Scan-by-code screen.
 *
 * Camera scanning is wired through expo-camera in builds that include it;
 * this screen also accepts manual input so techs can fall back to typing
 * the printed SKU / barcode when the camera struggles (poor light, glare,
 * damaged stickers).
 */
export default function ScanScreen() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<InventoryItemLookup | null>(null);

  const lookup = useMutation({
    mutationFn: (c: string) => inventoryApi.lookup(c),
    onSuccess: (item) => {
      if (!item) {
        setResult(null);
        Alert.alert('Not found', 'No inventory item matched that code.');
      } else {
        setResult(item);
      }
    },
    onError: (e: Error) => Alert.alert('Lookup failed', e.message),
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={{ padding: 16 }}>
        <View
          style={{
            backgroundColor: '#0F172A',
            padding: 18,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, opacity: 0.7 }}>BARCODE / QR / SKU</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Scan or type code"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: '700',
              color: '#fff',
              borderBottomWidth: 2,
              borderBottomColor: '#0E7A4A',
              paddingVertical: 8,
            }}
          />
          <Pressable
            onPress={() => code.trim() && lookup.mutate(code.trim())}
            disabled={!code.trim() || lookup.isPending}
            style={{
              marginTop: 16,
              backgroundColor: '#0E7A4A',
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: 'center',
              opacity: !code.trim() || lookup.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {lookup.isPending ? 'Looking up…' : 'Look up item'}
            </Text>
          </Pressable>
        </View>

        {lookup.isPending ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {result ? (
          <View
            style={{
              marginTop: 16,
              backgroundColor: '#fff',
              padding: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800' }}>{result.name}</Text>
            <Text style={{ color: '#64748B', marginTop: 4 }}>
              {result.brand ?? 'No brand'} · {result.unit}
            </Text>
            <View style={{ height: 12 }} />
            <Row label="SKU" value={result.sku} mono />
            {result.barcode ? <Row label="Barcode" value={result.barcode} mono /> : null}
            <Row label="QR" value={result.qrCode} mono />
            <Row
              label="Cost"
              value={`₹${(result.costPriceMinor / 100).toLocaleString('en-IN')}`}
            />
            <Row
              label="MRP"
              value={`₹${(result.sellingPriceMinor / 100).toLocaleString('en-IN')}`}
            />
            <Text style={{ marginTop: 10, color: '#64748B', fontSize: 12 }}>
              Tip: open the related allocation in Van inventory to record usage or return.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#64748B' }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontFamily: mono ? 'Courier' : undefined }}>{value}</Text>
    </View>
  );
}
