import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Bolt, Camera, ImagePlus, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { StepPills } from '@/components/booking/step-pills';
import { APPLIANCES, getAppliance, type ApplianceIssue } from '@/content/appliances';
import { useAddresses, useCreateAddress } from '@/hooks/use-addresses';
import { useCreateBooking } from '@/hooks/use-bookings';
import { ApiError } from '@/lib/api-client';
import { track, Events } from '@/lib/analytics';
import { formatRupees } from '@/lib/format';
import { pickAndUploadImage } from '@/lib/upload';
import { useBookingDraft } from '@/state/booking-draft';
import { colors, radius, spacing } from '@/theme/tokens';

const SLOTS = [
  { id: 'morning', label: 'Morning', hint: '8 AM \u2014 11 AM' },
  { id: 'midday', label: 'Midday', hint: '11 AM \u2014 2 PM' },
  { id: 'afternoon', label: 'Afternoon', hint: '2 PM \u2014 5 PM' },
  { id: 'evening', label: 'Evening', hint: '5 PM \u2014 8 PM' },
];

export default function BookingFlow() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appliance?: string; issue?: string; emergency?: string }>();
  const draft = useBookingDraft();
  const create = useCreateBooking();

  useEffect(() => {
    if (draft.step === 'service' && (params.appliance || params.emergency)) {
      draft.patch({
        applianceId: typeof params.appliance === 'string' ? params.appliance : draft.applianceId,
        isEmergency: params.emergency === '1' ? true : draft.isEmergency,
      });
      if (typeof params.appliance === 'string') draft.setStep('issue');
    }
    track(Events.BookingStart, { source: 'mobile' });
    return () => {
      // Reset draft on unmount (closing the modal) so a future tap starts fresh.
      draft.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    track(Events.BookingStepView, { step: draft.step });
  }, [draft.step]);

  return (
    <Screen padded scroll={false}>
      <Header
        onBack={() => {
          if (draft.step === 'service') {
            router.back();
          } else {
            draft.back();
          }
        }}
        onClose={() => router.back()}
      />
      <View style={{ marginTop: spacing[3] }}>
        <StepPills active={draft.step} />
      </View>
      <View style={{ flex: 1, marginTop: spacing[4] }}>
        {draft.step === 'service' ? <ServiceStep /> : null}
        {draft.step === 'issue' ? <IssueStep /> : null}
        {draft.step === 'photos' ? <PhotosStep /> : null}
        {draft.step === 'schedule' ? <ScheduleStep /> : null}
        {draft.step === 'address' ? <AddressStep /> : null}
        {draft.step === 'review' ? (
          <ReviewStep
            submitting={create.isPending}
            onSubmit={async () => {
              track(Events.BookingSubmit);
              try {
                const booking = await create.mutateAsync({
                  applianceCategory: getAppliance(draft.applianceId!)?.category,
                  applianceId: draft.applianceId,
                  issueId: draft.issueId,
                  notes: draft.notes,
                  photoUrls: draft.photos,
                  scheduledAt: draft.scheduledAt,
                  slotLabel: draft.slotLabel,
                  isEmergency: draft.isEmergency,
                  addressId: draft.address?.id,
                  contactPhone: draft.contactPhone,
                });
                router.replace(`/booking/${booking.id}?fresh=1`);
              } catch (err) {
                Alert.alert(
                  'Could not book',
                  err instanceof ApiError ? err.message : 'Please try again.',
                );
              }
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Header({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing[2],
      }}
    >
      <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <ArrowLeft size={22} color={colors.ink} />
      </Pressable>
      <Text variant="h3">Book a service</Text>
      <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
        <X size={22} color={colors.inkMuted} />
      </Pressable>
    </View>
  );
}

function ServiceStep() {
  const draft = useBookingDraft();
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">What needs a fix?</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Pick the appliance you\u2019d like a verified pro to look at.
      </Text>
      <FlatList
        data={APPLIANCES}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing[3] }}
        contentContainerStyle={{ gap: spacing[3], paddingTop: spacing[4] }}
        renderItem={({ item }) => {
          const active = draft.applianceId === item.id;
          return (
            <Pressable
              onPress={() => draft.patch({ applianceId: item.id, issueId: null })}
              style={{ flex: 1 }}
              accessibilityRole="button"
            >
              <Card
                elevated={!active}
                style={{
                  borderColor: active ? colors.brand : colors.border,
                  borderWidth: active ? 2 : 1,
                  padding: spacing[4],
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.brand50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="h2">{item.emoji}</Text>
                </View>
                <Text variant="h3" style={{ marginTop: spacing[3] }}>
                  {item.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {item.issues.length} services \u2022 {item.visitMinutes} min visit
                </Text>
                {item.emergencyAvailable ? (
                  <View style={{ marginTop: spacing[2] }}>
                    <Badge tone="danger" label="Emergency available" small />
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
      <Button
        label="Continue"
        fullWidth
        size="lg"
        rightIcon={<ArrowRight color="#fff" size={18} />}
        disabled={!draft.applianceId}
        onPress={() => draft.next()}
      />
    </View>
  );
}

function IssueStep() {
  const draft = useBookingDraft();
  const appliance = getAppliance(draft.applianceId!);
  if (!appliance) return null;
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">What\u2019s going on?</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Picking the right issue helps the pro arrive with the right parts.
      </Text>
      <FlatList
        data={appliance.issues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing[2], paddingTop: spacing[4] }}
        renderItem={({ item }) => (
          <IssueRow
            issue={item}
            active={draft.issueId === item.id}
            onPress={() => draft.patch({ issueId: item.id })}
          />
        )}
      />
      {draft.isEmergency || appliance.emergencyAvailable ? (
        <View style={{ marginTop: spacing[3] }}>
          <EmergencyToggle />
        </View>
      ) : null}
      <Button
        label="Continue"
        fullWidth
        size="lg"
        rightIcon={<ArrowRight color="#fff" size={18} />}
        disabled={!draft.issueId}
        onPress={() => draft.next()}
        style={{ marginTop: spacing[3] }}
      />
    </View>
  );
}

function EmergencyToggle() {
  const draft = useBookingDraft();
  return (
    <Pressable
      onPress={() => draft.patch({ isEmergency: !draft.isEmergency })}
      accessibilityRole="switch"
      accessibilityState={{ checked: draft.isEmergency }}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}>
            <Bolt size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Emergency visit</Text>
              <Text variant="caption" tone="muted">
                Get a pro in 60 mins. Surcharge applies.
              </Text>
            </View>
          </View>
          <View
            style={{
              width: 44,
              height: 26,
              borderRadius: 999,
              backgroundColor: draft.isEmergency ? colors.danger : colors.border,
              padding: 3,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#fff',
                alignSelf: draft.isEmergency ? 'flex-end' : 'flex-start',
              }}
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function IssueRow({
  issue,
  active,
  onPress,
}: {
  issue: ApplianceIssue;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card
        padded={false}
        elevated={false}
        style={{
          padding: spacing[4],
          borderColor: active ? colors.brand : colors.border,
          borderWidth: active ? 2 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="h3">{issue.label}</Text>
            {issue.description ? (
              <Text variant="caption" tone="muted">
                {issue.description}
              </Text>
            ) : null}
          </View>
          {issue.estMinor ? (
            <Text variant="caption" tone="muted">
              from {formatRupees(issue.estMinor)}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function PhotosStep() {
  const draft = useBookingDraft();
  const [uploading, setUploading] = useState(false);

  async function add(source: 'camera' | 'library') {
    if (uploading) return;
    setUploading(true);
    try {
      const picked = await pickAndUploadImage(source);
      if (picked) {
        draft.patch({ photos: [...draft.photos, picked.publicUrl] });
        track(Events.BookingPhotoUpload, { source });
      }
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Please try again with a smaller image.',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">Add a few photos</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Optional but speeds up diagnosis. Up to 4 photos.
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
        <Button
          label="Camera"
          variant="secondary"
          leftIcon={<Camera size={16} color={colors.brand} />}
          onPress={() => add('camera')}
          loading={uploading}
          disabled={draft.photos.length >= 4}
        />
        <Button
          label="Library"
          variant="outline"
          leftIcon={<ImagePlus size={16} color={colors.ink} />}
          onPress={() => add('library')}
          loading={uploading}
          disabled={draft.photos.length >= 4}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4], flexWrap: 'wrap' }}>
        {draft.photos.map((url) => (
          <View key={url} style={{ width: 96, height: 96, position: 'relative' }}>
            <Image
              source={{ uri: url }}
              style={{ width: 96, height: 96, borderRadius: radius.lg }}
            />
            <Pressable
              onPress={() =>
                draft.patch({ photos: draft.photos.filter((p) => p !== url) })
              }
              accessibilityLabel="Remove photo"
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: colors.ink,
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ marginTop: spacing[4] }}>
        <Input
          label="Anything else the pro should know?"
          placeholder="Brand, age, error code, etc."
          multiline
          numberOfLines={4}
          value={draft.notes}
          onChangeText={(v) => draft.patch({ notes: v })}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </View>

      <View style={{ flex: 1 }} />
      <Button
        label="Continue"
        fullWidth
        size="lg"
        rightIcon={<ArrowRight color="#fff" size={18} />}
        onPress={() => useBookingDraft.getState().next()}
      />
    </View>
  );
}

function ScheduleStep() {
  const draft = useBookingDraft();
  const dates = useMemo(() => nextNDates(5), []);
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]!.iso);
  const [slot, setSlot] = useState<string | null>(null);

  useEffect(() => {
    if (slot) {
      const meta = SLOTS.find((s) => s.id === slot);
      const scheduledAt = new Date(`${selectedDate}T${defaultHour(slot ?? 'morning')}:00:00`);
      draft.patch({
        scheduledAt: scheduledAt.toISOString(),
        slotLabel: meta ? `${labelDate(selectedDate)} \u2022 ${meta.label}` : null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, slot]);

  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">When works for you?</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Same-day slots fill fast. Book earlier for guaranteed availability.
      </Text>
      <Text variant="caption" tone="muted" style={{ marginTop: spacing[4] }}>
        Date
      </Text>
      <FlatList
        horizontal
        data={dates}
        keyExtractor={(d) => d.iso}
        contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[2] }}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = item.iso === selectedDate;
          return (
            <Pressable onPress={() => setSelectedDate(item.iso)}>
              <View
                style={{
                  width: 64,
                  alignItems: 'center',
                  paddingVertical: spacing[3],
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brand50 : colors.surface,
                }}
              >
                <Text variant="caption" tone={active ? 'brand' : 'muted'}>
                  {item.dow}
                </Text>
                <Text variant="h2" tone={active ? 'brand' : 'default'}>
                  {item.day}
                </Text>
                <Text variant="micro" tone={active ? 'brand' : 'subtle'}>
                  {item.month}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      <Text variant="caption" tone="muted" style={{ marginTop: spacing[4] }}>
        Time slot
      </Text>
      <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
        {SLOTS.map((s) => {
          const active = slot === s.id;
          return (
            <Pressable key={s.id} onPress={() => setSlot(s.id)}>
              <Card
                padded={false}
                elevated={false}
                style={{
                  padding: spacing[4],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderColor: active ? colors.brand : colors.border,
                  borderWidth: active ? 2 : 1,
                }}
              >
                <View>
                  <Text variant="h3">{s.label}</Text>
                  <Text variant="caption" tone="muted">
                    {s.hint}
                  </Text>
                </View>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brand : 'transparent',
                  }}
                />
              </Card>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Button
        label="Continue"
        fullWidth
        size="lg"
        rightIcon={<ArrowRight color="#fff" size={18} />}
        disabled={!slot}
        onPress={() => useBookingDraft.getState().next()}
      />
    </View>
  );
}

function AddressStep() {
  const draft = useBookingDraft();
  const addresses = useAddresses();
  const create = useCreateAddress();
  const [showSheet, setShowSheet] = useState(false);
  const [form, setForm] = useState({
    line1: '',
    line2: '',
    city: '',
    pincode: '',
    label: 'HOME' as const,
  });

  useEffect(() => {
    if (!draft.address && addresses.data?.length) {
      const def = addresses.data.find((a) => a.isDefault) ?? addresses.data[0]!;
      draft.patch({ address: def });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.data]);

  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">Service address</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Choose where the pro should reach. You can save more addresses anytime.
      </Text>
      <View style={{ marginTop: spacing[4], gap: spacing[2] }}>
        {(addresses.data ?? []).map((addr) => {
          const active = draft.address?.id === addr.id;
          return (
            <Pressable key={addr.id} onPress={() => draft.patch({ address: addr })}>
              <Card
                padded={false}
                elevated={false}
                style={{
                  padding: spacing[4],
                  borderColor: active ? colors.brand : colors.border,
                  borderWidth: active ? 2 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="h3">{addr.label}</Text>
                  {addr.isDefault ? <Badge tone="brand" label="Default" small /> : null}
                </View>
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {[addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ')}
                </Text>
              </Card>
            </Pressable>
          );
        })}
        <Button
          label="Add new address"
          variant="outline"
          onPress={() => setShowSheet(true)}
        />
      </View>
      <View style={{ flex: 1 }} />
      <Button
        label="Continue"
        fullWidth
        size="lg"
        rightIcon={<ArrowRight color="#fff" size={18} />}
        disabled={!draft.address}
        onPress={() => useBookingDraft.getState().next()}
      />
      <Sheet open={showSheet} onClose={() => setShowSheet(false)} title="New address">
        <View style={{ gap: spacing[3] }}>
          <Input
            label="Address line 1"
            value={form.line1}
            onChangeText={(v) => setForm({ ...form, line1: v })}
            placeholder="Flat / house no, building"
          />
          <Input
            label="Address line 2"
            value={form.line2}
            onChangeText={(v) => setForm({ ...form, line2: v })}
            placeholder="Area / street (optional)"
          />
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ flex: 2 }}>
              <Input
                label="City"
                value={form.city}
                onChangeText={(v) => setForm({ ...form, city: v })}
                placeholder="Bengaluru"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Pincode"
                value={form.pincode}
                onChangeText={(v) => setForm({ ...form, pincode: v.replace(/[^\d]/g, '') })}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          </View>
          <Button
            label="Save address"
            loading={create.isPending}
            onPress={async () => {
              try {
                const created = await create.mutateAsync({
                  ...form,
                  setDefault: !addresses.data?.length,
                });
                draft.patch({ address: created });
                setShowSheet(false);
              } catch (err) {
                Alert.alert(
                  'Could not save',
                  err instanceof ApiError ? err.message : 'Please try again.',
                );
              }
            }}
            disabled={!form.line1 || !form.city || form.pincode.length !== 6}
            fullWidth
            size="lg"
          />
        </View>
      </Sheet>
    </View>
  );
}

function ReviewStep({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: () => void;
}) {
  const draft = useBookingDraft();
  const appliance = getAppliance(draft.applianceId!);
  const issue = appliance?.issues.find((i) => i.id === draft.issueId);
  if (!appliance || !issue) return null;

  const baseMinor = issue.estMinor ?? appliance.estStartingMinor;
  const surchargeMinor = draft.isEmergency ? Math.round(baseMinor * 0.4) : 0;
  const total = baseMinor + surchargeMinor;

  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">Review & confirm</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Final cost is locked after the pro\u2019s on-site diagnosis. Visit charge is included if you
        decide not to repair.
      </Text>

      <Card style={{ marginTop: spacing[4] }}>
        <Row label="Service" value={`${appliance.name} \u2022 ${issue.label}`} />
        <Divider />
        <Row label="When" value={draft.slotLabel ?? '\u2014'} />
        <Divider />
        <Row
          label="Where"
          value={
            draft.address
              ? [draft.address.line1, draft.address.city].filter(Boolean).join(', ')
              : '\u2014'
          }
        />
        {draft.isEmergency ? (
          <>
            <Divider />
            <Row label="Type" value="Emergency \u2022 60-min response" />
          </>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing[3] }}>
        <Row label="Visit charge (est.)" value={formatRupees(baseMinor)} muted />
        {surchargeMinor > 0 ? (
          <Row label="Emergency surcharge" value={formatRupees(surchargeMinor)} muted />
        ) : null}
        <Divider />
        <Row label="Pay today" value={formatRupees(0)} bold />
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          You pay only after the work is complete and you\u2019re happy.
        </Text>
      </Card>

      <View style={{ flex: 1 }} />
      <Button
        label={`Confirm booking \u2022 est. ${formatRupees(total)}`}
        fullWidth
        size="lg"
        loading={submitting}
        onPress={onSubmit}
      />
      <Text variant="micro" tone="subtle" style={{ textAlign: 'center', marginTop: spacing[2] }}>
        By confirming you agree to our cancellation policy.
      </Text>
    </View>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <Text variant="caption" tone={muted ? 'muted' : 'default'}>
        {label}
      </Text>
      <Text variant={bold ? 'h3' : 'body'} weight={bold ? '700' : undefined}>
        {value}
      </Text>
    </View>
  );
}

function defaultHour(slot: string): string {
  if (slot === 'morning') return '09';
  if (slot === 'midday') return '12';
  if (slot === 'afternoon') return '15';
  return '18';
}

function nextNDates(n: number): { iso: string; dow: string; day: string; month: string }[] {
  const out: { iso: string; dow: string; day: string; month: string }[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: d.getDate().toString().padStart(2, '0'),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
    });
  }
  return out;
}

function labelDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
