import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { apiErrorMessage } from '../lib/api';
import { summarizeWarranty } from '../lib/jobcard-logic';
import { repairApi } from '../lib/repair-api';
import type { BookingDetail } from '../lib/technician-api';
import { Badge, Banner, Card, colors, EmptyNote, Row, SectionTitle } from './ui';

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');

/** Appliance details, warranty status and service history for the job screen. */
export function ApplianceCard({ booking }: { booking: BookingDetail }) {
  const applianceId = booking.applianceId ?? booking.appliance?.id ?? null;
  const [showAll, setShowAll] = useState(false);

  const warranty = useQuery({
    queryKey: ['warranty', applianceId],
    queryFn: () => repairApi.warrantyStatus(applianceId!),
    enabled: !!applianceId,
  });
  const history = useQuery({
    queryKey: ['appliance-history', applianceId],
    queryFn: () => repairApi.applianceHistory(applianceId!),
    enabled: !!applianceId,
  });

  const a = booking.appliance;
  const w = summarizeWarranty(warranty.data);
  const past = (history.data ?? []).filter((h) => h.id !== booking.id);
  const visible = showAll ? past : past.slice(0, 3);

  return (
    <View>
      {booking.isWarrantyRevisit ? (
        <View style={{ marginTop: 12 }}>
          <Banner
            tone="danger"
            title="WARRANTY REVISIT"
            body={`Repeat visit under repair warranty${
              booking.repairWarrantyUntil ? ` (valid until ${fmt(booking.repairWarrantyUntil)})` : ''
            }. Do not charge for the covered repair; record the root cause carefully.`}
          />
        </View>
      ) : null}

      <SectionTitle>Appliance</SectionTitle>
      <Card>
        {!applianceId && !a ? (
          <EmptyNote>
            No registered appliance linked. {booking.applianceBrand ?? ''} {booking.applianceType ?? ''}
          </EmptyNote>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', flexShrink: 1 }}>
                {a ? `${a.brand} ${a.category}` : 'Linked appliance'}
              </Text>
              {warranty.isLoading ? null : (
                <Badge label={w.headline} tone={w.covered ? 'success' : warranty.data ? 'neutral' : 'warning'} />
              )}
            </View>
            {a ? (
              <>
                <Row label="Model" value={a.modelNumber ?? '—'} />
                <Row label="Serial" value={a.serialNumber ?? '—'} />
                {a.capacity ? <Row label="Capacity" value={a.capacity} /> : null}
                {a.installedLocation ? <Row label="Location" value={a.installedLocation} /> : null}
                <Row label="Installed" value={fmt(a.installDate ?? a.purchaseDate)} />
                <Row label="Last serviced" value={fmt(a.lastServicedAt)} />
              </>
            ) : null}
            {w.lines.map((l) => (
              <Text key={l} style={{ color: colors.muted, fontSize: 12 }}>
                {l}
              </Text>
            ))}
            {warranty.isError ? (
              <Text style={{ color: colors.subtle, fontSize: 12 }}>
                Warranty status unavailable: {apiErrorMessage(warranty.error)}
              </Text>
            ) : null}
            {!warranty.isLoading && !warranty.isError && warranty.data === null ? (
              <Text style={{ color: colors.subtle, fontSize: 12 }}>Warranty lookup not available yet.</Text>
            ) : null}
          </>
        )}
      </Card>

      {applianceId ? (
        <>
          <SectionTitle>Service history</SectionTitle>
          <Card>
            {history.isLoading ? <EmptyNote>Loading…</EmptyNote> : null}
            {history.isError ? <EmptyNote>Couldn&apos;t load history.</EmptyNote> : null}
            {!history.isLoading && past.length === 0 ? <EmptyNote>No previous visits.</EmptyNote> : null}
            {visible.map((h) => (
              <View key={h.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontWeight: '600', flexShrink: 1 }}>
                    {fmt(h.completedAt ?? h.scheduledAt)} · {h.serviceType ?? h.category ?? 'Service'}
                  </Text>
                  {h.isWarrantyRevisit ? <Badge label="Revisit" tone="warning" /> : null}
                </View>
                {h.issueDescription ? <Text style={{ color: colors.muted }}>{h.issueDescription}</Text> : null}
                {h.resolution ? <Text style={{ color: colors.muted }}>Fix: {h.resolution}</Text> : null}
                <Text style={{ color: colors.subtle, fontSize: 12 }}>
                  {[h.code, h.status, h.technician?.fullName].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))}
            {past.length > 3 ? (
              <Pressable accessibilityRole="button" onPress={() => setShowAll((v) => !v)}>
                <Text style={{ color: colors.brand, fontWeight: '700' }}>
                  {showAll ? 'Show less' : `Show all ${past.length} visits`}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        </>
      ) : null}
    </View>
  );
}
