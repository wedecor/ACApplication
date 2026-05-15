import { useRouter } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useInvoices } from '@/hooks/use-invoices';
import { formatDate, formatRupees } from '@/lib/format';
import { spacing } from '@/theme/tokens';

import type { InvoiceSummary } from '@/api/types';

const STATUS_TONE: Record<InvoiceSummary['status'], 'success' | 'warn' | 'danger' | 'brand' | 'neutral'> = {
  PAID: 'success',
  PENDING: 'warn',
  PARTIAL: 'warn',
  REFUNDED: 'brand',
  CANCELLED: 'danger',
};

export default function InvoicesScreen() {
  const router = useRouter();
  const { data, isLoading, isFetching, refetch } = useInvoices();
  return (
    <Screen
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
    >
      <Text variant="h1">Invoices</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Pay online, download GST-ready PDFs, and track refunds in one place.
      </Text>
      <View style={{ marginTop: spacing[4] }}>
        {isLoading ? (
          <Card>
            <Skeleton width="40%" />
            <Skeleton width="80%" style={{ marginTop: 8 }} />
          </Card>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No invoices yet"
            subtitle="Invoices show up here after your first paid visit."
            icon={<ReceiptText size={26} />}
          />
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(i) => i.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: spacing[3] }}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/invoice/${item.id}`)}>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="h3">{item.number}</Text>
                      <Text variant="caption" tone="muted">
                        Issued {formatDate(item.issuedAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="h2">{formatRupees(item.amountMinor)}</Text>
                      <View style={{ marginTop: 4 }}>
                        <Badge tone={STATUS_TONE[item.status]} label={item.status.toLowerCase()} small />
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
