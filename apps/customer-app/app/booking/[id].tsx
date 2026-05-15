import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleHelp,
  MessageCircle,
  Phone,
  Star,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Timeline } from '@/components/booking/timeline';
import { TrackingMap } from '@/components/booking/tracking-map';
import {
  useBookingDetail,
  useCancelBooking,
  useRateBooking,
  useRescheduleBooking,
} from '@/hooks/use-bookings';
import { useTechnicianLocation } from '@/hooks/use-technician-location';
import { track, Events } from '@/lib/analytics';
import { dialPhone, openWhatsApp } from '@/lib/external';
import { formatDateTime, formatRupees } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

import type { BookingDetail } from '@/api/types';

const STATUS_LABEL: Record<BookingDetail['status'], string> = {
  CREATED: 'Booked',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Pro assigned',
  EN_ROUTE: 'Pro on the way',
  ARRIVED: 'Pro has arrived',
  IN_PROGRESS: 'In progress',
  AWAITING_PARTS: 'Awaiting parts',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

const SHOW_LIVE: BookingDetail['status'][] = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];
const ALLOWS_RESCHEDULE: BookingDetail['status'][] = ['CREATED', 'CONFIRMED', 'ASSIGNED'];
const ALLOWS_CANCEL: BookingDetail['status'][] = ['CREATED', 'CONFIRMED', 'ASSIGNED'];

export default function BookingDetailScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const query = useBookingDetail(id);
  const cancel = useCancelBooking(id ?? '');
  const reschedule = useRescheduleBooking(id ?? '');
  const rate = useRateBooking(id ?? '');
  const location = useTechnicianLocation(SHOW_LIVE.includes(query.data?.status as never) ? id : undefined);
  const [rateOpen, setRateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const showLive = useMemo(
    () => query.data && SHOW_LIVE.includes(query.data.status),
    [query.data],
  );

  if (!id) return null;

  return (
    <Screen padded>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Text variant="h2">Booking details</Text>
      </View>

      {fresh === '1' ? (
        <Card style={{ marginTop: spacing[4], backgroundColor: '#ecfdf5' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
            <CheckCircle2 color={colors.accent} size={22} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Booking confirmed!</Text>
              <Text variant="caption" tone="muted">
                You\u2019ll get a push notification the moment a pro is assigned.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {query.isLoading ? (
        <Card style={{ marginTop: spacing[4] }}>
          <Skeleton width="50%" />
          <Skeleton width="80%" style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={180} style={{ marginTop: 12 }} rounded={radius.lg} />
        </Card>
      ) : query.data ? (
        <Detail
          booking={query.data}
          locationData={location.data ?? null}
          showLive={!!showLive}
          onCall={() =>
            query.data?.technician?.phone &&
            (track(Events.TrackingCallTech, { bookingId: id }), dialPhone(query.data.technician.phone))
          }
          onWhatsApp={() =>
            query.data?.technician?.whatsapp &&
            (track(Events.TrackingWhatsAppTech, { bookingId: id }),
            openWhatsApp(
              `Hi, this is about booking ${query.data.code}. `,
              query.data.technician.whatsapp,
            ))
          }
          onReschedule={() => promptReschedule(reschedule, id)}
          onCancel={() => setCancelOpen(true)}
          onRate={() => setRateOpen(true)}
          onComplaint={() => router.push(`/support?bookingId=${id}`)}
        />
      ) : (
        <Card style={{ marginTop: spacing[4] }}>
          <Text variant="h3">Booking not found</Text>
          <Text variant="caption" tone="muted">
            It may have been removed. Pull to refresh or contact support.
          </Text>
        </Card>
      )}

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel booking">
        <Text variant="body" tone="muted">
          Tell us why you\u2019re cancelling so we can improve.
        </Text>
        <View style={{ marginTop: spacing[3] }}>
          <Input
            placeholder="e.g. plans changed"
            value={reason}
            onChangeText={setReason}
          />
        </View>
        <Button
          label="Cancel booking"
          variant="danger"
          fullWidth
          style={{ marginTop: spacing[3] }}
          loading={cancel.isPending}
          disabled={reason.trim().length < 3}
          onPress={async () => {
            try {
              await cancel.mutateAsync({ reason });
              setCancelOpen(false);
              setReason('');
            } catch (err) {
              Alert.alert('Could not cancel', err instanceof Error ? err.message : 'Try again.');
            }
          }}
        />
      </Sheet>

      <Sheet open={rateOpen} onClose={() => setRateOpen(false)} title="Rate your visit">
        <RatingForm
          submitting={rate.isPending}
          onSubmit={async (payload) => {
            try {
              await rate.mutateAsync(payload);
              setRateOpen(false);
            } catch (err) {
              Alert.alert('Could not submit', err instanceof Error ? err.message : 'Try again.');
            }
          }}
        />
      </Sheet>
    </Screen>
  );
}

async function promptReschedule(
  reschedule: ReturnType<typeof useRescheduleBooking>,
  _id: string,
): Promise<void> {
  // Native picker not bundled to keep payload small. Default to "in 24h" with
  // a confirmation prompt; richer pickers can be added later.
  const proposed = new Date(Date.now() + 24 * 60 * 60 * 1000);
  Alert.alert(
    'Reschedule booking',
    `Move this booking to ${proposed.toLocaleString('en-IN')}?`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Reschedule',
        onPress: async () => {
          try {
            await reschedule.mutateAsync({ scheduledAt: proposed.toISOString() });
            Alert.alert('Updated', 'We\u2019ll notify the pro about the new time.');
          } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Try again.');
          }
        },
      },
    ],
  );
}

interface LocationData {
  lat: number;
  lng: number;
  bearing?: number | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  recordedAt: string;
}

function Detail({
  booking,
  locationData,
  showLive,
  onCall,
  onWhatsApp,
  onReschedule,
  onCancel,
  onRate,
  onComplaint,
}: {
  booking: BookingDetail;
  locationData: LocationData | null;
  showLive: boolean;
  onCall: () => void;
  onWhatsApp: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onRate: () => void;
  onComplaint: () => void;
}) {
  return (
    <>
      <Card style={{ marginTop: spacing[4] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge
            tone={
              booking.status === 'COMPLETED'
                ? 'success'
                : booking.status === 'CANCELLED' || booking.status === 'NO_SHOW'
                  ? 'danger'
                  : 'brand'
            }
            label={STATUS_LABEL[booking.status]}
          />
          <Text variant="caption" tone="muted">
            #{booking.code}
          </Text>
        </View>
        <Text variant="h1" style={{ marginTop: spacing[3] }}>
          {booking.applianceLabel}
        </Text>
        <Text variant="caption" tone="muted">
          {booking.issueLabel}
        </Text>
        <Divider />
        <Text variant="caption" tone="muted">
          Scheduled for
        </Text>
        <Text variant="h3">{formatDateTime(booking.scheduledAt)}</Text>
        {booking.estimateMinor ? (
          <>
            <Divider />
            <Text variant="caption" tone="muted">
              Estimate
            </Text>
            <Text variant="h3">{formatRupees(booking.estimateMinor)}</Text>
          </>
        ) : null}
      </Card>

      {showLive ? (
        <Card style={{ marginTop: spacing[3] }}>
          <Text variant="h3">Live tracking</Text>
          {locationData ? (
            <Text variant="caption" tone="muted">
              ETA{' '}
              <Text variant="caption" tone="brand" weight="700">
                {locationData.etaMinutes ?? '\u2014'} min
              </Text>{' '}
              \u2022 {locationData.distanceKm?.toFixed(1) ?? '\u2014'} km away
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Pro will share their location once they\u2019re on the way.
            </Text>
          )}
          <View style={{ marginTop: spacing[3] }}>
            <TrackingMap booking={booking} location={locationData} />
          </View>
          {booking.technician ? (
            <View style={{ marginTop: spacing[3] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.brand50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="h3" tone="brand">
                    {booking.technician.fullName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{booking.technician.fullName}</Text>
                  <Text variant="caption" tone="muted">
                    {booking.technician.completedJobs ?? 0}+ jobs \u2022{' '}
                    {booking.technician.rating?.toFixed(1) ?? '\u2014'} \u2605
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                <Button
                  label="Call"
                  variant="secondary"
                  leftIcon={<Phone size={16} color={colors.brand} />}
                  onPress={onCall}
                />
                <Button
                  label="WhatsApp"
                  variant="accent"
                  leftIcon={<MessageCircle size={16} color="#fff" />}
                  onPress={onWhatsApp}
                />
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing[3] }}>
        <Text variant="h3" style={{ marginBottom: spacing[3] }}>
          Status timeline
        </Text>
        <Timeline timeline={booking.timeline} />
      </Card>

      {booking.address ? (
        <Card style={{ marginTop: spacing[3] }}>
          <Text variant="caption" tone="muted">
            Service address
          </Text>
          <Text variant="h3" style={{ marginTop: 4 }}>
            {[booking.address.line1, booking.address.line2].filter(Boolean).join(', ')}
          </Text>
          <Text variant="caption" tone="muted">
            {booking.address.city} \u2022 {booking.address.pincode}
          </Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3], flexWrap: 'wrap' }}>
        {ALLOWS_RESCHEDULE.includes(booking.status) ? (
          <Button label="Reschedule" variant="outline" onPress={onReschedule} />
        ) : null}
        {ALLOWS_CANCEL.includes(booking.status) ? (
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        ) : null}
        {booking.status === 'COMPLETED' && !booking.rating ? (
          <Button
            label="Rate visit"
            variant="primary"
            leftIcon={<Star size={16} color="#fff" />}
            onPress={onRate}
          />
        ) : null}
        <Button
          label="Need help?"
          variant="ghost"
          leftIcon={<CircleHelp size={16} color={colors.brand} />}
          onPress={onComplaint}
        />
      </View>

      {booking.photoUrls.length > 0 ? (
        <Card style={{ marginTop: spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Camera size={16} color={colors.inkMuted} />
            <Text variant="h3">Photos shared</Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {booking.photoUrls.length} attached
          </Text>
        </Card>
      ) : null}

      {booking.status === 'CANCELLED' || booking.status === 'NO_SHOW' ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            marginTop: spacing[3],
          }}
        >
          <AlertTriangle size={14} color={colors.danger} />
          <Text variant="caption" tone="danger">
            This booking is closed. Tap "Need help?" to dispute or reorder.
          </Text>
        </View>
      ) : null}
    </>
  );
}

function RatingForm({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (payload: { value: number; comment?: string }) => void;
}) {
  const [value, setValue] = useState(5);
  const [comment, setComment] = useState('');
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing[2], justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable
            key={v}
            onPress={() => setValue(v)}
            accessibilityLabel={`Rate ${v} star${v > 1 ? 's' : ''}`}
          >
            <Star
              size={32}
              color={v <= value ? colors.warn : colors.border}
              fill={v <= value ? colors.warn : 'transparent'}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: spacing[3] }}>
        <Input
          label="Tell us more (optional)"
          placeholder="What went well or what could improve?"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
        />
      </View>
      <Button
        label="Submit rating"
        fullWidth
        size="lg"
        style={{ marginTop: spacing[3] }}
        loading={submitting}
        onPress={() => onSubmit({ value, comment: comment || undefined })}
      />
    </View>
  );
}
