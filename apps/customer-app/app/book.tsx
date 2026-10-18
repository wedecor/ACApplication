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
import {
  APPLIANCES,
  getAppliance,
  getApplianceByCategory,
  type ApplianceIssue,
} from '@/content/appliances';
import { useAddresses, useCreateAddress } from '@/hooks/use-addresses';
import { useAppliances } from '@/hooks/use-appliances';
import { useBookingEstimate, useBookingSlots, useCreateBooking } from '@/hooks/use-bookings';
import { useValidateCoupon } from '@/hooks/use-growth';
import { ApiError } from '@/lib/api-client';
import { track, Events } from '@/lib/analytics';
import { formatRupees } from '@/lib/format';
import { pickAndUploadImage } from '@/lib/upload';
import { toCreateBookingInput, useBookingDraft } from '@/state/booking-draft';
import { warrantyLabel, warrantyTone } from '@/lib/warranty';
import { colors, radius, spacing } from '@/theme/tokens';
import { ApplianceIcon } from '@/components/appliance-icon';

const SLOTS = [
  { id: 'morning', label: 'Morning', hint: '8 AM — 11 AM' },
  { id: 'midday', label: 'Midday', hint: '11 AM — 2 PM' },
  { id: 'afternoon', label: 'Afternoon', hint: '2 PM — 5 PM' },
  { id: 'evening', label: 'Evening', hint: '5 PM — 8 PM' },
];

export default function BookingFlow() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    appliance?: string;
    issue?: string;
    emergency?: string;
    /** Registered appliance id (from "My appliances"). */
    registered?: string;
  }>();
  const draft = useBookingDraft();
  const create = useCreateBooking();

  useEffect(() => {
    if (draft.step === 'service' && (params.appliance || params.emergency)) {
      draft.patch({
        applianceId: typeof params.appliance === 'string' ? params.appliance : draft.applianceId,
        isEmergency: params.emergency === '1' ? true : draft.isEmergency,
        customerApplianceId: typeof params.registered === 'string' ? params.registered : null,
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
              const input = toCreateBookingInput(useBookingDraft.getState());
              if (!input) {
                Alert.alert('Almost there', 'Please pick a service, slot and address.');
                return;
              }
              try {
                const booking = await create.mutateAsync(input);
                router.replace({ pathname: '/booking/[id]', params: { id: booking.id, fresh: '1' } });
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
  const mine = useAppliances();
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">What needs a fix?</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Pick the appliance you’d like a verified pro to look at.
      </Text>
      {mine.data?.length ? (
        <View style={{ marginTop: spacing[3] }}>
          <Text variant="caption" tone="muted">
            Your appliances (optional)
          </Text>
          <FlatList
            horizontal
            data={mine.data}
            keyExtractor={(a) => a.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[2] }}
            renderItem={({ item }) => {
              const active = draft.customerApplianceId === item.id;
              const catalogue = getApplianceByCategory(item.category);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() =>
                    active
                      ? draft.patch({ customerApplianceId: null })
                      : draft.patch({
                          customerApplianceId: item.id,
                          applianceId: catalogue?.id ?? draft.applianceId,
                          issueId: catalogue?.id === draft.applianceId ? draft.issueId : null,
                        })
                  }
                >
                  <Card
                    padded={false}
                    elevated={false}
                    style={{
                      padding: spacing[3],
                      minWidth: 150,
                      borderColor: active ? colors.brand : colors.border,
                      borderWidth: active ? 2 : 1,
                    }}
                  >
                    <Text variant="h3" numberOfLines={1}>
                      {item.brand}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {item.installedLocation ?? item.categoryLabel}
                    </Text>
                    <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                      <Badge
                        small
                        tone={warrantyTone(item.warranty.status)}
                        label={warrantyLabel(item.warranty.status, item.warranty.daysLeft)}
                      />
                    </View>
                  </Card>
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}
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
              onPress={() => {
                const linked = mine.data?.find((a) => a.id === draft.customerApplianceId);
                const keepLinked = linked && getApplianceByCategory(linked.category)?.id === item.id;
                draft.patch({
                  applianceId: item.id,
                  issueId: null,
                  customerApplianceId: keepLinked ? draft.customerApplianceId : null,
                });
              }}
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
                  <ApplianceIcon category={item.category} />
                </View>
                <Text variant="h3" style={{ marginTop: spacing[3] }}>
                  {item.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {item.issues.length} services • {item.visitMinutes} min visit
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
      <Text variant="h1">What’s going on?</Text>
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
  const addresses = useAddresses();
  const dates = useMemo(() => nextNDates(5), []);
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]!.iso);
  const [slot, setSlot] = useState<string | null>(null);
  const appliance = draft.applianceId ? getAppliance(draft.applianceId) : undefined;
  const city =
    draft.address?.city ??
    (addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0])?.city ??
    undefined;
  const live = useBookingSlots(
    appliance ? { applianceCategory: appliance.category, city, date: selectedDate } : null,
  );

  // Live capacity-based windows from the API; static windows if it is unreachable.
  const options = useMemo(() => {
    if (live.data?.slots?.length) {
      return live.data.slots.map((s, idx) => ({
        id: s.start,
        label: SLOTS[idx]?.label ?? formatTime(s.start),
        hint: `${formatTime(s.start)} — ${formatTime(s.end)}`,
        start: s.start,
        end: s.end,
        available: s.available,
      }));
    }
    return SLOTS.map((s) => {
      const start = new Date(`${selectedDate}T${defaultHour(s.id)}:00:00`);
      return {
        id: s.id,
        label: s.label,
        hint: s.hint,
        start: start.toISOString(),
        end: new Date(start.getTime() + 3 * 3600_000).toISOString(),
        available: start.getTime() > Date.now() + 3600_000,
      };
    });
  }, [live.data, selectedDate]);

  useEffect(() => {
    setSlot(null);
  }, [selectedDate]);

  useEffect(() => {
    const meta = options.find((o) => o.id === slot);
    if (meta) {
      draft.patch({
        scheduledAt: meta.start,
        slotEnd: meta.end,
        slotLabel: `${labelDate(selectedDate)} • ${meta.label}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, options]);

  const noneAvailable = !live.isLoading && options.every((o) => !o.available);

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
        {options.map((s) => {
          const active = slot === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => s.available && setSlot(s.id)}
              disabled={!s.available}
              accessibilityState={{ disabled: !s.available, selected: active }}
            >
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
                  opacity: s.available ? 1 : 0.5,
                }}
              >
                <View>
                  <Text variant="h3">{s.label}</Text>
                  <Text variant="caption" tone="muted">
                    {s.available ? s.hint : `${s.hint} • Full`}
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
        {noneAvailable ? (
          <Text variant="caption" tone="muted">
            No slots left on this day — try another date.
          </Text>
        ) : null}
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
  const mine = useAppliances();
  const estimate = useBookingEstimate(
    appliance
      ? {
          applianceCategory: appliance.category,
          issueId: draft.issueId ?? undefined,
          city: draft.address?.city,
          isEmergency: draft.isEmergency,
        }
      : null,
  );
  const validate = useValidateCoupon();
  const [couponInput, setCouponInput] = useState(draft.couponCode ?? '');
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  if (!appliance || !issue) return null;

  // Server estimate (catalog-priced, surge included); static catalogue as fallback.
  const fallbackBase = issue.estMinor ?? appliance.estStartingMinor;
  const total =
    estimate.data?.estimateMinor ?? fallbackBase + (draft.isEmergency ? Math.round(fallbackBase * 0.4) : 0);
  const surgeMultiplier = estimate.data?.surgeMultiplier ?? (draft.isEmergency ? 1.4 : 1);
  const baseMinor = Math.round(total / surgeMultiplier);
  const surchargeMinor = total - baseMinor;
  const discountMinor = Math.min(draft.couponDiscountMinor, total);
  const linked = mine.data?.find((a) => a.id === draft.customerApplianceId);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    try {
      const res = await validate.mutateAsync({ code, category: appliance!.category, amountMinor: total });
      if (res.valid) {
        draft.patch({ couponCode: code.toUpperCase(), couponDiscountMinor: res.discountMinor });
        setCouponMessage(res.message ?? `Coupon applied — you save ${formatRupees(res.discountMinor)}`);
      } else {
        draft.patch({ couponCode: null, couponDiscountMinor: 0 });
        setCouponMessage(res.message ?? 'This coupon is not valid for this booking.');
      }
    } catch (err) {
      setCouponMessage(err instanceof ApiError ? err.message : 'Could not check the coupon. Try again.');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1">Review & confirm</Text>
      <Text variant="body" tone="muted" style={{ marginTop: 6 }}>
        Final cost is locked after the pro’s on-site diagnosis. Visit charge is included if you
        decide not to repair.
      </Text>

      <Card style={{ marginTop: spacing[4] }}>
        <Row label="Service" value={`${appliance.name} • ${issue.label}`} />
        {linked ? (
          <>
            <Divider />
            <Row label="Appliance" value={[linked.brand, linked.modelNumber].filter(Boolean).join(' ')} />
          </>
        ) : null}
        <Divider />
        <Row label="When" value={draft.slotLabel ?? '—'} />
        <Divider />
        <Row
          label="Where"
          value={
            draft.address
              ? [draft.address.line1, draft.address.city].filter(Boolean).join(', ')
              : '—'
          }
        />
        {draft.isEmergency ? (
          <>
            <Divider />
            <Row label="Type" value="Emergency • 60-min response" />
          </>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing[3] }}>
        <View style={{ flexDirection: 'row', gap: spacing[2], alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Coupon code (optional)"
              placeholder="e.g. FIRST100"
              autoCapitalize="characters"
              value={couponInput}
              onChangeText={(v) => {
                setCouponInput(v);
                if (draft.couponCode) draft.patch({ couponCode: null, couponDiscountMinor: 0 });
                setCouponMessage(null);
              }}
            />
          </View>
          <Button
            label={draft.couponCode ? 'Applied' : 'Apply'}
            variant="outline"
            loading={validate.isPending}
            disabled={!couponInput.trim() || !!draft.couponCode}
            onPress={applyCoupon}
          />
        </View>
        {couponMessage ? (
          <Text
            variant="caption"
            tone={draft.couponCode ? 'brand' : 'danger'}
            style={{ marginTop: 6 }}
          >
            {couponMessage}
          </Text>
        ) : null}
      </Card>

      <Card style={{ marginTop: spacing[3] }}>
        <Row label="Visit charge (est.)" value={formatRupees(baseMinor)} muted />
        {surchargeMinor > 0 ? (
          <Row label="Emergency surcharge" value={formatRupees(surchargeMinor)} muted />
        ) : null}
        {discountMinor > 0 ? (
          <Row label={`Coupon ${draft.couponCode}`} value={`−${formatRupees(discountMinor)}`} muted />
        ) : null}
        <Divider />
        <Row label="Pay today" value={formatRupees(0)} bold />
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          You pay only after the work is complete and you’re happy.
        </Text>
      </Card>

      <View style={{ flex: 1 }} />
      <Button
        label={`Confirm booking • est. ${formatRupees(total - discountMinor)}`}
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function labelDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
