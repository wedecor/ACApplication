import { CreditCard, Star, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SubHeader } from '@/components/layout/sub-header';
import {
  usePaymentMethods,
  useRefunds,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
} from '@/hooks/use-payments';
import { formatRupees } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';

export default function PaymentMethodsScreen() {
  const methods = usePaymentMethods();
  const refunds = useRefunds();
  const setDefault = useSetDefaultPaymentMethod();
  const remove = useRemovePaymentMethod();
  return (
    <Screen padded>
      <SubHeader title="Payment methods" />
      <Text variant="body" tone="muted" style={{ marginTop: spacing[2] }}>
        Cards and UPI handles you save here are managed by our payment partner. We never store
        full card numbers.
      </Text>

      <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
        {methods.isLoading ? (
          <Card>
            <Skeleton width="40%" />
            <Skeleton width="80%" style={{ marginTop: 8 }} />
          </Card>
        ) : (methods.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No saved methods"
            subtitle="Pay any pending invoice and we\u2019ll offer to save your card / UPI handle for one-tap reuse."
            icon={<CreditCard size={26} />}
          />
        ) : (
          (methods.data ?? []).map((m) => (
            <Card key={m.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="h3">{m.label}</Text>
                {m.isDefault ? <Badge tone="brand" label="Default" small /> : null}
              </View>
              <Text variant="caption" tone="muted">
                {m.type === 'UPI' ? 'UPI' : m.brand ?? ''} {m.last4 ? `\u2022\u2022 ${m.last4}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
                {!m.isDefault ? (
                  <Pressable onPress={() => setDefault.mutate(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Star size={14} color={colors.brand} />
                    <Text variant="caption" tone="brand" weight="600">
                      Set as default
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() =>
                    Alert.alert('Remove method?', m.label, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => remove.mutate(m.id),
                      },
                    ])
                  }
                >
                  <Trash2 size={14} color={colors.danger} />
                  <Text variant="caption" tone="danger" weight="600">
                    Remove
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </View>

      <Text variant="h3" style={{ marginTop: spacing[6] }}>
        Refunds
      </Text>
      <View style={{ marginTop: spacing[2], gap: spacing[2] }}>
        {(refunds.data?.length ?? 0) === 0 ? (
          <Text variant="caption" tone="muted">
            No refunds in flight. Issued refunds typically settle within 5\u20137 business days.
          </Text>
        ) : (
          (refunds.data ?? []).map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="h3">{formatRupees(r.amountMinor)}</Text>
                <Badge label={r.status.toLowerCase()} tone="brand" small />
              </View>
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                Initiated on {new Date(r.createdAt).toLocaleDateString('en-IN')}
              </Text>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
