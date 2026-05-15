import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, Download } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useConfirmInvoicePayment, useInvoiceDetail } from '@/hooks/use-invoices';
import { track, Events } from '@/lib/analytics';
import { formatDate, formatRupees } from '@/lib/format';
import { payInvoice } from '@/lib/payments';
import { colors, spacing } from '@/theme/tokens';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const detail = useInvoiceDetail(id);
  const confirm = useConfirmInvoicePayment(id ?? '');
  const [paying, setPaying] = useState<'razorpay' | 'stripe' | null>(null);

  async function handlePay(gateway: 'razorpay' | 'stripe') {
    if (!id) return;
    setPaying(gateway);
    track(Events.PaymentStart, { invoiceId: id, gateway });
    const result = await payInvoice(id, { gateway });
    setPaying(null);
    if (result.status === 'PAID' || result.status === 'PARTIAL') {
      track(Events.PaymentSuccess, { invoiceId: id, gateway });
      confirm.mutate({ gateway });
      Alert.alert(
        'Payment successful',
        result.receiptUrl ? 'Your receipt is now available to download.' : 'Receipt will be available shortly.',
      );
    } else if (result.status === 'CANCELLED') {
      // user-initiated, no toast
    } else {
      track(Events.PaymentFailed, { invoiceId: id, gateway, reason: result.message ?? 'unknown' });
      Alert.alert('Payment failed', result.message ?? 'Please try again.');
    }
  }

  return (
    <Screen padded>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Text variant="h2">Invoice</Text>
      </View>

      {detail.isLoading ? (
        <Card style={{ marginTop: spacing[4] }}>
          <Skeleton width="40%" />
          <Skeleton width="80%" style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={160} style={{ marginTop: 12 }} />
        </Card>
      ) : detail.data ? (
        <View style={{ marginTop: spacing[4], gap: spacing[3] }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text variant="h2">{detail.data.number}</Text>
                <Text variant="caption" tone="muted">
                  Issued {formatDate(detail.data.issuedAt)}
                </Text>
              </View>
              <Badge
                label={detail.data.status.toLowerCase()}
                tone={
                  detail.data.status === 'PAID'
                    ? 'success'
                    : detail.data.status === 'CANCELLED'
                      ? 'danger'
                      : 'warn'
                }
              />
            </View>
            <Divider />
            <Text variant="caption" tone="muted">
              Amount
            </Text>
            <Text variant="display">{formatRupees(detail.data.amountMinor)}</Text>
            {detail.data.dueAt ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
                Due by {formatDate(detail.data.dueAt)}
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text variant="h3">Breakdown</Text>
            <View style={{ marginTop: spacing[2] }}>
              {detail.data.lineItems.map((line, idx) => (
                <View
                  key={`${line.label}-${idx}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                  }}
                >
                  <Text variant="caption" tone="muted">
                    {line.label}
                  </Text>
                  <Text variant="caption">{formatRupees(line.amountMinor)}</Text>
                </View>
              ))}
              <Divider />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="h3">Total</Text>
                <Text variant="h3">{formatRupees(detail.data.amountMinor)}</Text>
              </View>
            </View>
          </Card>

          {detail.data.status === 'PAID' ? (
            <Card style={{ backgroundColor: '#ecfdf5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <CheckCircle2 color={colors.accent} size={20} />
                <Text variant="h3">Paid in full</Text>
              </View>
              <Button
                label="Download receipt"
                variant="outline"
                style={{ marginTop: spacing[3] }}
                leftIcon={<Download size={16} color={colors.ink} />}
                onPress={() => detail.data?.pdfUrl && Linking.openURL(detail.data.pdfUrl)}
                disabled={!detail.data.pdfUrl}
              />
            </Card>
          ) : (
            <View style={{ gap: spacing[2] }}>
              <Button
                label={`Pay ${formatRupees(detail.data.amountMinor)} with UPI / Cards`}
                fullWidth
                size="lg"
                loading={paying === 'razorpay'}
                onPress={() => handlePay('razorpay')}
              />
              <Button
                label="Pay with International Card"
                variant="outline"
                fullWidth
                loading={paying === 'stripe'}
                onPress={() => handlePay('stripe')}
              />
            </View>
          )}
        </View>
      ) : (
        <Card style={{ marginTop: spacing[4] }}>
          <Text variant="h3">Invoice not found</Text>
        </Card>
      )}
    </Screen>
  );
}
