import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Banner, Button, Card, Chip, colors, EmptyNote, Field, Row, SectionTitle } from '../../src/components/ui';
import { apiErrorCode, apiErrorMessage } from '../../src/lib/api';
import { formatMinor, minorToRupeesInput, rupeesToMinor } from '../../src/lib/money';
import { fieldBillingApi } from '../../src/lib/repair-api';
import type { FieldBillingSummary, FieldPaymentMethod } from '../../src/lib/repair-types';
import { technicianApi } from '../../src/lib/technician-api';

const INVOICE_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

const INVOICEABLE = new Set(['IN_PROGRESS', 'COMPLETED']);

/**
 * Payment collection via the technician-scoped field-billing endpoints
 * (/repair/field-billing/:bookingId): amount due, raise the invoice on
 * site, hosted payment link as a scannable QR (Razorpay links accept UPI),
 * or record a cash / UPI / card payment.
 */
export default function PaymentCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<FieldPaymentMethod>('CASH');
  const [reference, setReference] = useState('');

  const booking = useQuery({ queryKey: ['job', id], queryFn: () => technicianApi.booking(id) });
  const billing = useQuery({
    queryKey: ['field-billing', id],
    queryFn: () => fieldBillingApi.summary(id),
  });
  const setSummary = (s: FieldBillingSummary) => qc.setQueryData(['field-billing', id], s);

  const raiseInvoice = useMutation({
    mutationFn: () => fieldBillingApi.raiseInvoice(id),
    onSuccess: (s) => {
      setSummary(s);
      Alert.alert('Invoice raised', s.invoice ? `${s.invoice.number} · ${formatMinor(s.invoice.dueAmountMinor)} due` : undefined);
    },
    onError: (err: unknown) => Alert.alert('Could not raise invoice', apiErrorMessage(err)),
  });

  const createLink = useMutation({
    mutationFn: () => fieldBillingApi.paymentLink(id),
    onSuccess: (link) => {
      if (!link.url) {
        Alert.alert('No link returned', 'The payment provider did not return a link.');
        return;
      }
      qc.setQueryData<FieldBillingSummary>(['field-billing', id], (old) => (old ? { ...old, paymentLink: link } : old));
    },
    onError: (err: unknown) => Alert.alert('Could not create payment link', apiErrorMessage(err)),
  });

  const record = useMutation({
    mutationFn: (amountMinor: number) =>
      fieldBillingApi.recordPayment(id, {
        method,
        amountMinor,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      }),
    onSuccess: (s) => {
      setSummary(s);
      setAmountText('');
      setReference('');
      Alert.alert('Payment recorded');
    },
    onError: (err: unknown) => {
      if (apiErrorCode(err) === 'AMOUNT_EXCEEDS_DUE') {
        void billing.refetch();
        Alert.alert('Amount too high', 'The amount is more than what is due. The balance has been refreshed.');
      } else {
        Alert.alert('Could not record payment', apiErrorMessage(err));
      }
    },
  });

  const inv = billing.data?.invoice ?? null;
  const link = billing.data?.paymentLink ?? null;

  const onRecord = () => {
    if (!inv) return;
    const amount = amountText.trim() ? rupeesToMinor(amountText) : inv.dueAmountMinor;
    if (amount == null || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter the amount collected.');
      return;
    }
    if (amount > inv.dueAmountMinor) {
      Alert.alert('Amount too high', `Only ${formatMinor(inv.dueAmountMinor)} is due.`);
      return;
    }
    Alert.alert('Confirm payment', `Record ${formatMinor(amount)} received by ${method}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Record', onPress: () => record.mutate(amount) },
    ]);
  };

  if (booking.isLoading || billing.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  const b = booking.data;
  const settled = inv != null && inv.dueAmountMinor <= 0;
  const canRaise = b != null && INVOICEABLE.has(b.status) && !b.isWarrantyRevisit;
  const quote = billing.data?.quotation ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={billing.isRefetching} onRefresh={() => void billing.refetch()} />}
    >
      {billing.isError ? (
        <View style={{ gap: 8 }}>
          <Banner tone="danger" title="Couldn't load billing" body={apiErrorMessage(billing.error)} />
          <Button variant="outline" label="Retry" onPress={() => void billing.refetch()} />
        </View>
      ) : null}

      {billing.isSuccess && !inv ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>No invoice yet</Text>
          {b?.isWarrantyRevisit ? (
            <Banner tone="warning" title="Warranty revisit" body="Covered repairs are not invoiced." />
          ) : (
            <>
              <Text style={{ color: colors.muted }}>
                {quote?.status === 'APPROVED'
                  ? `The approved quotation ${quote.number} (${formatMinor(quote.totalMinor)}) will be converted.`
                  : 'The invoice is built from the final amount, the catalog service or the booking estimate.'}
              </Text>
              {!canRaise ? (
                <Text style={{ color: colors.warning }}>Start the service before raising the invoice.</Text>
              ) : null}
              <Button
                label="Raise invoice"
                loading={raiseInvoice.isPending}
                disabled={!canRaise}
                onPress={() =>
                  Alert.alert('Raise invoice?', 'The customer will be billed for this job.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Raise invoice', onPress: () => raiseInvoice.mutate() },
                  ])
                }
              />
            </>
          )}
        </Card>
      ) : null}

      {inv ? (
        <>
          <SectionTitle right={<Badge label={inv.status.replace(/_/g, ' ')} tone={INVOICE_TONE[inv.status] ?? 'neutral'} />}>
            Invoice {inv.number}
          </SectionTitle>
          <Card>
            <Row label="Total" value={formatMinor(inv.totalMinor)} />
            <Row label="Paid" value={formatMinor(inv.amountPaidMinor)} />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700' }}>Amount due</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: settled ? colors.brand : colors.text }}>
                {formatMinor(inv.dueAmountMinor)}
              </Text>
            </View>
          </Card>

          {settled ? (
            <View style={{ marginTop: 12 }}>
              <Banner tone="success" title="Fully paid" body="Nothing left to collect." />
            </View>
          ) : (
            <>
              <SectionTitle right={link ? <Badge label={link.status} tone="info" /> : null}>Online / UPI</SectionTitle>
              <Card style={{ gap: 12 }}>
                {link?.url ? (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <QRCode value={link.url} size={200} />
                    <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
                      Customer scans with any UPI / camera app to pay {formatMinor(inv.dueAmountMinor)}
                    </Text>
                    <Button
                      variant="outline"
                      label="Share payment link"
                      onPress={() =>
                        void Share.share({
                          message: `Pay ${formatMinor(inv.dueAmountMinor)} for invoice ${inv.number}: ${link.url}`,
                        }).catch(() => undefined)
                      }
                    />
                  </View>
                ) : null}
                <Button
                  label={link ? 'Refresh payment link' : 'Generate payment link / QR'}
                  variant={link ? 'outline' : 'primary'}
                  loading={createLink.isPending}
                  onPress={() => createLink.mutate()}
                />
                {link ? (
                  <Button small variant="outline" label="Check payment status" onPress={() => void billing.refetch()} />
                ) : null}
              </Card>

              <SectionTitle>Record cash / direct payment</SectionTitle>
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                    <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />
                  ))}
                </View>
                <Field
                  label="Amount received (₹)"
                  keyboardType="decimal-pad"
                  value={amountText}
                  onChangeText={setAmountText}
                  placeholder={minorToRupeesInput(inv.dueAmountMinor)}
                  hint="Leave blank to record the full amount due."
                />
                {method !== 'CASH' ? (
                  <Field
                    label="Reference / UTR"
                    value={reference}
                    onChangeText={setReference}
                    placeholder="Transaction reference"
                    autoCapitalize="characters"
                  />
                ) : null}
                <Button label="Record payment" loading={record.isPending} onPress={onRecord} />
              </Card>
            </>
          )}

          <SectionTitle>Payments</SectionTitle>
          <Card>
            {(billing.data?.payments ?? []).length === 0 ? <EmptyNote>No payments yet.</EmptyNote> : null}
            {(billing.data?.payments ?? []).map((p) => (
              <Row
                key={p.id}
                label={`${p.method} · ${new Date(p.createdAt).toLocaleString('en-IN')}`}
                value={`${formatMinor(p.amountMinor)} ${p.status}`}
              />
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
