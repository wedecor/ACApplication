import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Banner, Button, Card, colors, EmptyNote, Field, Row, SectionTitle } from '../../src/components/ui';
import { VanPartsPicker } from '../../src/components/VanPartsPicker';
import { apiErrorMessage } from '../../src/lib/api';
import { type Quotation, quotationApprovalUrl, quotationsApi } from '../../src/lib/billing-api';
import { formatMinor, minorToRupeesInput, rupeesToMinor } from '../../src/lib/money';
import {
  computeQuoteTotals,
  type QuoteLine,
  toQuotationLineItems,
  upsertQuoteLine,
  validateQuoteLines,
} from '../../src/lib/quote-math';
import { fieldBillingApi, repairApi } from '../../src/lib/repair-api';
import type { CatalogItem, FieldBillingQuotation } from '../../src/lib/repair-types';
import { technicianApi } from '../../src/lib/technician-api';

/** Spare parts + repair labour are 18 % GST in India (HSN 8415 parts / SAC 9987). */
const DEFAULT_PART_GST_BPS = 1800;
const DEFAULT_LABOUR_GST_BPS = 1800;

/** Field-billing summary quotation, enriched with the detail (lines, tax) when readable. */
type QuoteView = FieldBillingQuotation & Partial<Pick<Quotation, 'lineItems' | 'taxMinor'>>;

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  VIEWED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
  CONVERTED: 'success',
};

/**
 * On-site quotation: catalog services + parts from the van + labour,
 * created through the existing /quotations API and shared with the
 * customer for approval (link / QR, or approve on this device).
 */
export default function OnSiteQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [labourDesc, setLabourDesc] = useState('');
  const [labourAmount, setLabourAmount] = useState('');

  const booking = useQuery({ queryKey: ['job', id], queryFn: () => technicianApi.booking(id) });
  const b = booking.data;
  const customerId = b?.customerId ?? b?.customer.id;
  const category = b?.appliance?.category ?? b?.category ?? null;

  const existing = useQuery({
    queryKey: ['quotations', id],
    queryFn: async (): Promise<QuoteView | null> => {
      const summary = await fieldBillingApi.summary(id);
      if (!summary.quotation) return null;
      // Detail adds line items + tax; fall back to the summary if not allowed.
      const full = await quotationsApi.get(summary.quotation.id).catch(() => null);
      return full ? { ...summary.quotation, ...full } : summary.quotation;
    },
  });
  const current = existing.data ?? null;

  const totals = useMemo(() => computeQuoteTotals(lines, gstEnabled), [lines, gstEnabled]);
  const errors = useMemo(() => validateQuoteLines(lines), [lines]);

  const create = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Booking has no customer');
      const q = await quotationsApi.create({
        customerId,
        bookingId: id,
        lineItems: toQuotationLineItems(lines),
        gstEnabled,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      // Technician-scoped send notifies the customer. If it fails the quote
      // still exists — the tech can share the link / QR or retry sending.
      try {
        const sent = await fieldBillingApi.sendQuotation(id);
        return { quotation: { ...q, ...sent }, sendError: null };
      } catch (err) {
        return { quotation: q, sendError: apiErrorMessage(err) };
      }
    },
    onSuccess: ({ quotation, sendError }) => {
      qc.setQueryData<QuoteView | null>(['quotations', id], quotation);
      setLines([]);
      Alert.alert(
        `Quotation ${quotation.number} created`,
        sendError
          ? `Couldn't notify the customer (${sendError}). Share the link, show the QR code, or tap "Send to customer".`
          : 'The customer has been notified. You can also show them the QR code.',
      );
      void existing.refetch();
    },
    onError: (err: unknown) => Alert.alert('Could not create quotation', apiErrorMessage(err)),
  });

  const send = useMutation({
    mutationFn: () => fieldBillingApi.sendQuotation(id),
    onSuccess: () => {
      void existing.refetch();
      Alert.alert('Quotation sent', 'The customer has been notified.');
    },
    onError: (err: unknown) => Alert.alert('Could not send quotation', apiErrorMessage(err)),
  });

  const approve = useMutation({
    mutationFn: (viewToken: string) => quotationsApi.approveOnSite(viewToken),
    onSuccess: () => {
      void existing.refetch();
      Alert.alert('Quotation approved', 'Go ahead with the repair.');
    },
    onError: (err: unknown) => Alert.alert('Could not approve', apiErrorMessage(err)),
  });

  const addCatalog = (item: CatalogItem) => {
    setCatalogOpen(false);
    setLines((prev) => {
      let next = upsertQuoteLine(prev, {
        key: Crypto.randomUUID(),
        kind: 'CATALOG',
        refId: item.id,
        description: item.name,
        quantity: 1,
        unitPriceMinor: item.basePriceMinor,
        discountMinor: 0,
        taxRateBps: item.gstRateBps,
      });
      if (item.visitChargeMinor > 0 && !next.some((l) => l.kind === 'VISIT')) {
        next = [
          ...next,
          {
            key: Crypto.randomUUID(),
            kind: 'VISIT',
            description: 'Visit charge',
            quantity: 1,
            unitPriceMinor: item.visitChargeMinor,
            discountMinor: 0,
            taxRateBps: item.gstRateBps,
          },
        ];
      }
      return next;
    });
  };

  const addLabour = () => {
    const amount = rupeesToMinor(labourAmount);
    if (!labourDesc.trim() || amount == null) {
      Alert.alert('Labour line', 'Enter a description and a valid amount.');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: Crypto.randomUUID(),
        kind: 'LABOUR',
        description: labourDesc.trim(),
        quantity: 1,
        unitPriceMinor: amount,
        discountMinor: 0,
        taxRateBps: DEFAULT_LABOUR_GST_BPS,
      },
    ]);
    setLabourDesc('');
    setLabourAmount('');
  };

  const shareLink = async (q: QuoteView & { viewToken: string }) => {
    const url = quotationApprovalUrl(q);
    await Share.share({
      message: `Quotation ${q.number} for ${formatMinor(q.totalMinor)}. Review and approve: ${url}`,
    }).catch(() => undefined);
  };

  if (booking.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      {b?.isWarrantyRevisit ? (
        <Banner
          tone="warning"
          title="Warranty revisit"
          body="Repairs covered by the previous job's warranty should not be charged."
        />
      ) : null}

      {existing.isError ? (
        <View style={{ marginTop: 12 }}>
          <EmptyNote>Couldn&apos;t check existing quotations: {apiErrorMessage(existing.error)}</EmptyNote>
        </View>
      ) : null}

      {current ? (
        <>
          <SectionTitle right={<Badge label={current.status} tone={STATUS_TONE[current.status] ?? 'neutral'} />}>
            Quotation {current.number}
          </SectionTitle>
          <Card style={{ gap: 10 }}>
            {(current.lineItems ?? []).map((li, idx) => (
              <Row key={idx} label={`${li.quantity} × ${li.description}`} value={formatMinor(li.totalMinor)} />
            ))}
            {current.taxMinor != null ? <Row label="Tax" value={formatMinor(current.taxMinor)} /> : null}
            <Row label="Total" value={formatMinor(current.totalMinor)} />
            {current.status === 'APPROVED' || current.status === 'CONVERTED' ? (
              <Banner tone="success" title="Approved by customer" />
            ) : current.status === 'REJECTED' ? (
              <Banner tone="danger" title="Rejected by customer" />
            ) : (
              <>
                {current.status === 'DRAFT' ? (
                  <Button label="Send to customer" loading={send.isPending} onPress={() => send.mutate()} />
                ) : null}
                {current.viewToken ? (
                  <ApprovalActions
                    quote={{ ...current, viewToken: current.viewToken }}
                    approving={approve.isPending}
                    onShare={(q) => void shareLink(q)}
                    onApprove={(token) => approve.mutate(token)}
                  />
                ) : (
                  <EmptyNote>Approval link unavailable — the customer was notified by the office.</EmptyNote>
                )}
              </>
            )}
            <Button small variant="outline" label="Refresh status" onPress={() => void existing.refetch()} />
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>Build quotation</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button flex={1} variant="outline" label="+ Service" onPress={() => setCatalogOpen(true)} />
            <Button flex={1} variant="outline" label="+ Part (van)" onPress={() => setPartsOpen(true)} />
          </View>

          <Card style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: '600' }}>Add labour</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={labourDesc}
                onChangeText={setLabourDesc}
                placeholder="e.g. Gas top-up labour"
                placeholderTextColor={colors.subtle}
                style={[inputStyle, { flex: 2 }]}
              />
              <TextInput
                value={labourAmount}
                onChangeText={setLabourAmount}
                placeholder="₹"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.subtle}
                style={[inputStyle, { flex: 1 }]}
              />
            </View>
            <Button small label="Add labour" onPress={addLabour} />
          </Card>

          <SectionTitle>Lines</SectionTitle>
          <Card style={{ gap: 12 }}>
            {lines.length === 0 ? <EmptyNote>No lines yet.</EmptyNote> : null}
            {lines.map((l) => (
              <QuoteLineEditor
                key={l.key}
                line={l}
                totalMinor={totals.lines.find((t) => t.key === l.key)?.totalMinor ?? 0}
                onChange={(next) => setLines((prev) => prev.map((x) => (x.key === l.key ? next : x)))}
                onRemove={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
              />
            ))}
          </Card>

          <SectionTitle>Summary</SectionTitle>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Apply GST</Text>
              <Switch value={gstEnabled} onValueChange={setGstEnabled} />
            </View>
            <Row label="Subtotal" value={formatMinor(totals.subtotalMinor)} />
            {totals.discountMinor > 0 ? <Row label="Discounts" value={`-${formatMinor(totals.discountMinor)}`} /> : null}
            <Row label="GST" value={formatMinor(totals.taxMinor)} />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <Row label="Total" value={formatMinor(totals.totalMinor)} />
            <Field label="Notes for the customer" multiline value={notes} onChangeText={setNotes} />
            {lines.length > 0 && errors.length > 0 ? (
              <Text style={{ color: colors.danger }}>{errors.join('\n')}</Text>
            ) : null}
            <Button
              label="Create & send for approval"
              loading={create.isPending}
              disabled={errors.length > 0 || !customerId}
              onPress={() => create.mutate()}
            />
          </Card>
        </>
      )}

      <CatalogPicker
        visible={catalogOpen}
        category={category}
        onClose={() => setCatalogOpen(false)}
        onPick={addCatalog}
      />
      <VanPartsPicker
        visible={partsOpen}
        onClose={() => setPartsOpen(false)}
        onPick={(row) => {
          setPartsOpen(false);
          setLines((prev) =>
            upsertQuoteLine(prev, {
              key: Crypto.randomUUID(),
              kind: 'PART',
              refId: row.item.id,
              description: row.item.name,
              quantity: 1,
              unitPriceMinor: row.item.sellingPriceMinor,
              discountMinor: 0,
              taxRateBps: DEFAULT_PART_GST_BPS,
              maxQuantity: row.remainingQty,
            }),
          );
        }}
      />
    </ScrollView>
  );
}

function ApprovalActions({
  quote,
  approving,
  onShare,
  onApprove,
}: {
  quote: QuoteView & { viewToken: string };
  approving: boolean;
  onShare: (q: QuoteView & { viewToken: string }) => void;
  onApprove: (viewToken: string) => void;
}) {
  return (
    <>
      <View style={{ alignItems: 'center', paddingVertical: 8, gap: 6 }}>
        <QRCode value={quotationApprovalUrl(quote)} size={180} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Customer scans to review & approve</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button flex={1} variant="outline" label="Share link" onPress={() => onShare(quote)} />
        <Button
          flex={1}
          label="Approve here"
          loading={approving}
          onPress={() =>
            Alert.alert('Customer approval', `Hand the phone to the customer. Approve ${formatMinor(quote.totalMinor)}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Customer approves', onPress: () => onApprove(quote.viewToken) },
            ])
          }
        />
      </View>
    </>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 8,
  backgroundColor: '#fff',
  color: colors.text,
} as const;

function QuoteLineEditor({
  line,
  totalMinor,
  onChange,
  onRemove,
}: {
  line: QuoteLine;
  totalMinor: number;
  onChange: (l: QuoteLine) => void;
  onRemove: () => void;
}) {
  const [priceText, setPriceText] = useState(minorToRupeesInput(line.unitPriceMinor));
  const [discountText, setDiscountText] = useState(line.discountMinor ? minorToRupeesInput(line.discountMinor) : '');
  return (
    <View style={{ gap: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontWeight: '700' }}>{line.description}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {line.kind.toLowerCase()} · GST {line.taxRateBps / 100}%
            {line.maxQuantity != null ? ` · ${line.maxQuantity} in van` : ''}
          </Text>
        </View>
        <Text style={{ fontWeight: '800' }}>{formatMinor(totalMinor)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button
          small
          variant="outline"
          label="−"
          onPress={() => (line.quantity <= 1 ? onRemove() : onChange({ ...line, quantity: line.quantity - 1 }))}
        />
        <Text style={{ fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{line.quantity}</Text>
        <Button
          small
          variant="outline"
          label="+"
          disabled={line.maxQuantity != null && line.quantity >= line.maxQuantity}
          onPress={() => onChange({ ...line, quantity: line.quantity + 1 })}
        />
        <TextInput
          value={priceText}
          keyboardType="decimal-pad"
          accessibilityLabel="Unit price in rupees"
          onChangeText={(t) => {
            setPriceText(t);
            const v = rupeesToMinor(t);
            if (v != null) onChange({ ...line, unitPriceMinor: v });
          }}
          style={[inputStyle, { flex: 1, textAlign: 'right' }]}
        />
        <TextInput
          value={discountText}
          placeholder="Disc ₹"
          placeholderTextColor={colors.subtle}
          keyboardType="decimal-pad"
          accessibilityLabel="Discount in rupees"
          onChangeText={(t) => {
            setDiscountText(t);
            const v = t.trim() === '' ? 0 : rupeesToMinor(t);
            if (v != null) onChange({ ...line, discountMinor: v });
          }}
          style={[inputStyle, { width: 72, textAlign: 'right' }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Remove line" onPress={onRemove}>
          <Text style={{ color: colors.danger, fontWeight: '800', padding: 4 }}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CatalogPicker({
  visible,
  category,
  onPick,
  onClose,
}: {
  visible: boolean;
  category: string | null;
  onPick: (item: CatalogItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const catalog = useQuery({
    queryKey: ['repair-catalog', category],
    queryFn: () => repairApi.catalog({ category }),
    enabled: visible,
    staleTime: 10 * 60_000,
  });
  const items = (catalog.data ?? []).filter(
    (c) => !q.trim() || `${c.name} ${c.code}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: 48, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>Services</Text>
          <Button small variant="outline" label="Close" onPress={onClose} />
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search services" placeholderTextColor={colors.subtle} style={inputStyle} />
        {catalog.isLoading ? (
          <ActivityIndicator />
        ) : catalog.isError ? (
          <EmptyNote>Couldn&apos;t load catalog: {apiErrorMessage(catalog.error)}</EmptyNote>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<EmptyNote>No services in the catalog for {category ?? 'this category'}.</EmptyNote>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => onPick(item)}
                style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, gap: 2 }}
              >
                <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.code} · {formatMinor(item.basePriceMinor)}
                  {item.visitChargeMinor > 0 ? ` + visit ${formatMinor(item.visitChargeMinor)}` : ''}
                  {item.repairWarrantyDays ? ` · ${item.repairWarrantyDays}d warranty` : ''}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}
