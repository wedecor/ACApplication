import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getTechnicianId } from '../../src/lib/auth';
import { inventoryApi, type VanInventoryRow } from '../../src/lib/inventory-api';
import { getSocket } from '../../src/lib/socket';

/**
 * Van inventory — the technician's mobile stock register.
 *
 * Lists ALLOCATED / ACKNOWLEDGED / USED allocations, lets the technician
 * tap-acknowledge, record usage on a booking, or return unused parts to
 * the source warehouse. Realtime updates land via the inventory event
 * channel.
 */
export default function VanInventoryScreen() {
  const qc = useQueryClient();
  const [techId, setTechId] = useState<string | null>(null);

  useEffect(() => {
    void getTechnicianId().then(setTechId);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      const socket = await getSocket();
      const refetch = () => {
        void qc.invalidateQueries({ queryKey: ['van-inventory'] });
      };
      socket.on('inventory.stock_updated', refetch);
      socket.on('inventory.technician_stock_allocated', refetch);
      socket.on('inventory.technician_stock_used', refetch);
      socket.on('inventory.technician_stock_returned', refetch);
      socket.on('inventory.technician_stock_acknowledged', refetch);
      unsubscribe = () => {
        socket.off('inventory.stock_updated', refetch);
        socket.off('inventory.technician_stock_allocated', refetch);
        socket.off('inventory.technician_stock_used', refetch);
        socket.off('inventory.technician_stock_returned', refetch);
        socket.off('inventory.technician_stock_acknowledged', refetch);
      };
    })();
    return () => {
      unsubscribe?.();
    };
  }, [qc]);

  const van = useQuery({
    queryKey: ['van-inventory', techId],
    queryFn: () => inventoryApi.vanInventory(techId as string),
    enabled: !!techId,
  });

  const totals = useMemo(() => {
    const rows = van.data ?? [];
    return {
      lines: rows.length,
      pieces: rows.reduce((s, r) => s + r.remainingQty, 0),
      valueMinor: rows.reduce(
        (s, r) => s + r.remainingQty * r.item.sellingPriceMinor,
        0,
      ),
      pendingAck: rows.filter((r) => r.status === 'ALLOCATED').length,
    };
  }, [van.data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F7FA' }}
      refreshControl={
        <RefreshControl refreshing={van.isRefetching} onRefresh={() => void van.refetch()} />
      }
    >
      <View
        style={{
          margin: 16,
          padding: 20,
          backgroundColor: '#0E7A4A',
          borderRadius: 16,
        }}
      >
        <Text style={{ color: '#fff', opacity: 0.7, fontSize: 12 }}>VAN STOCK</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 }}>
          {totals.lines} SKUs · {totals.pieces} pcs
        </Text>
        <Text style={{ color: '#fff', opacity: 0.85, marginTop: 4 }}>
          Approx value ₹{(totals.valueMinor / 100).toLocaleString('en-IN')}
        </Text>
        {totals.pendingAck > 0 ? (
          <Text style={{ color: '#FEF3C7', marginTop: 8, fontWeight: '600' }}>
            ⚠ {totals.pendingAck} allocation(s) pending acknowledgement
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
        <Link href="/inventory/scan" asChild>
          <Pressable
            style={{
              flex: 1,
              paddingVertical: 14,
              backgroundColor: '#fff',
              borderRadius: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontWeight: '700' }}>Scan SKU</Text>
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              Look up by barcode / QR
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>
          ALLOCATIONS
        </Text>
        <View style={{ height: 12 }} />
        {van.isLoading ? (
          <ActivityIndicator />
        ) : van.data && van.data.length > 0 ? (
          van.data.map((row) => <AllocationCard key={row.id} row={row} />)
        ) : (
          <View
            style={{
              padding: 24,
              backgroundColor: '#fff',
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#64748B' }}>No active allocations.</Text>
            <Text style={{ color: '#94A3B8', marginTop: 4, fontSize: 12 }}>
              Stock issued by dispatch will show up here.
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function AllocationCard({ row }: { row: VanInventoryRow }) {
  const qc = useQueryClient();
  const [returnQty, setReturnQty] = useState<string>('');
  const [useQty, setUseQty] = useState<string>('');

  const ack = useMutation({
    mutationFn: () => inventoryApi.acknowledge(row.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['van-inventory'] }),
    onError: (e: Error) => Alert.alert('Acknowledge failed', e.message),
  });
  const use = useMutation({
    mutationFn: (qty: number) =>
      inventoryApi.use(row.id, {
        usedQty: qty,
        bookingId: row.bookingId ?? undefined,
      }),
    onSuccess: () => {
      setUseQty('');
      void qc.invalidateQueries({ queryKey: ['van-inventory'] });
    },
    onError: (e: Error) => Alert.alert('Record usage failed', e.message),
  });
  const ret = useMutation({
    mutationFn: (qty: number) => inventoryApi.returnStock(row.id, { returnedQty: qty }),
    onSuccess: () => {
      setReturnQty('');
      void qc.invalidateQueries({ queryKey: ['van-inventory'] });
    },
    onError: (e: Error) => Alert.alert('Return failed', e.message),
  });

  return (
    <View
      style={{
        backgroundColor: '#fff',
        padding: 14,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>{row.item.name}</Text>
          <Text style={{ color: '#475569', marginTop: 2, fontSize: 12 }}>
            SKU {row.item.sku} · {row.item.unit}
          </Text>
        </View>
        <StatusPill status={row.status} />
      </View>

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <Metric label="Allocated" value={row.allocatedQty} />
        <Metric label="Used" value={row.usedQty} />
        <Metric label="Returned" value={row.returnedQty} />
        <Metric label="On van" value={row.remainingQty} highlight />
      </View>

      {row.status === 'ALLOCATED' ? (
        <Pressable
          onPress={() => ack.mutate()}
          disabled={ack.isPending}
          style={{
            marginTop: 12,
            paddingVertical: 12,
            backgroundColor: '#0E7A4A',
            borderRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {ack.isPending ? 'Acknowledging…' : 'Acknowledge receipt'}
          </Text>
        </Pressable>
      ) : null}

      {row.status !== 'ALLOCATED' && row.remainingQty > 0 ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Use qty"
              keyboardType="number-pad"
              value={useQty}
              onChangeText={setUseQty}
              style={inputStyle}
            />
            <Pressable
              onPress={() => {
                const n = Number(useQty);
                if (!Number.isFinite(n) || n <= 0) return;
                if (n > row.remainingQty) {
                  Alert.alert('Too many', 'Cannot use more than is on van.');
                  return;
                }
                use.mutate(n);
              }}
              disabled={use.isPending}
              style={{
                paddingHorizontal: 16,
                justifyContent: 'center',
                backgroundColor: '#0061C4',
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Record use</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Return qty"
              keyboardType="number-pad"
              value={returnQty}
              onChangeText={setReturnQty}
              style={inputStyle}
            />
            <Pressable
              onPress={() => {
                const n = Number(returnQty);
                if (!Number.isFinite(n) || n <= 0) return;
                if (n > row.remainingQty) {
                  Alert.alert('Too many', 'Cannot return more than is on van.');
                  return;
                }
                ret.mutate(n);
              }}
              disabled={ret.isPending}
              style={{
                paddingHorizontal: 16,
                justifyContent: 'center',
                backgroundColor: '#92400E',
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Return</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const inputStyle = {
  flex: 1,
  borderWidth: 1,
  borderColor: '#CBD5E1',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: '#fff',
} as const;

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <View>
      <Text style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color: highlight ? '#0E7A4A' : '#0F172A',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: VanInventoryRow['status'] }) {
  const palette: Record<VanInventoryRow['status'], { fg: string; bg: string }> = {
    ALLOCATED: { fg: '#92400E', bg: '#FEF3C7' },
    ACKNOWLEDGED: { fg: '#0061C4', bg: '#DBEAFE' },
    USED: { fg: '#6D28D9', bg: '#EDE9FE' },
    RETURNED: { fg: '#065F46', bg: '#D1FAE5' },
    RECONCILED: { fg: '#374151', bg: '#F3F4F6' },
    PARTIAL_RETURN: { fg: '#9F1239', bg: '#FFE4E6' },
  };
  const p = palette[status];
  return (
    <View
      style={{
        backgroundColor: p.bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: p.fg, fontSize: 11, fontWeight: '700' }}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}
