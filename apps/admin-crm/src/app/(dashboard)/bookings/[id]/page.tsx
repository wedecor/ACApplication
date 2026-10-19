'use client';

import { BookingStatus } from '@ac/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { BookingStatusActions } from '@/components/bookings/booking-status-actions';
import {
  BookingPaymentBadge,
  BookingStatusBadge,
} from '@/components/bookings/booking-status-badge';
import { OtpVerifyForm } from '@/components/bookings/otp-verify-form';
import { RescheduleForm } from '@/components/bookings/reschedule-form';
import { ContactButtons } from '@/components/common/contact-buttons';
import { Timeline } from '@/components/common/timeline';
import { BookingRepairPanel } from '@/components/repair/booking-repair-panel';
import { useBooking, useBookingActivities } from '@/hooks/use-bookings';
import { useRealtime } from '@/hooks/use-realtime';
import { formatWhen } from '@/lib/format';
import { categoryLabel } from '@/lib/labels';

function formatINR(minor: number | null | undefined): string {
  if (minor == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export default function BookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading } = useBooking(id);
  const { data: activities = [] } = useBookingActivities(id);
  useRealtime({ rooms: id ? [`booking:${id}`] : [] });

  if (isLoading || !booking) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/bookings"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {booking.customer.fullName}
            </h1>
            <BookingStatusBadge status={booking.status} />
            <BookingPaymentBadge status={booking.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{booking.code}</p>
        </div>
        <BookingStatusActions id={booking.id} current={booking.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <Timeline entries={activities} />
            </TabsContent>
            <TabsContent value="actions" className="mt-4 space-y-6">
              {booking.status === BookingStatus.TECHNICIAN_EN_ROUTE ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Verify arrival OTP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OtpVerifyForm id={booking.id} />
                  </CardContent>
                </Card>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle>Reschedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <RescheduleForm
                    id={booking.id}
                    current={booking.scheduledAt}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-line break-words">{booking.issueDescription || 'No issue described.'}</p>
              <dl className="space-y-2">
                <Row label="Service">
                  {[categoryLabel(booking.category), booking.serviceType].filter(Boolean).join(' · ')}
                </Row>
                {booking.applianceType || booking.applianceBrand ? (
                  <Row label="Appliance">
                    {[booking.applianceBrand, booking.applianceType].filter(Boolean).join(' ')}
                  </Row>
                ) : null}
                <Row label="When">
                  {formatWhen(booking.scheduledAt)}
                  {booking.scheduledTimeSlot ? (
                    <span className="block text-xs text-muted-foreground">Slot {booking.scheduledTimeSlot}</span>
                  ) : null}
                </Row>
                <Row label="Address">
                  {[booking.address?.line1, booking.address?.line2, booking.city.name, booking.address?.pincode]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </Row>
                {booking.lead ? (
                  <Row label="Source lead">
                    <Link href={`/leads/${booking.lead.id}`} className="text-primary hover:underline">
                      {booking.lead.code}
                    </Link>
                  </Row>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="space-y-2">
                <Row label="Name">
                  <Link href={`/customers/${booking.customer.id}`} className="hover:underline">
                    {booking.customer.fullName}
                  </Link>
                </Row>
                <Row label="Phone">{booking.customer.phone}</Row>
              </dl>
              <ContactButtons phone={booking.customer.phone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Technician</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {booking.technician ? (
                <>
                  <dl className="space-y-2">
                    <Row label="Name">{booking.technician.fullName}</Row>
                    <Row label="Phone">{booking.technician.phone}</Row>
                  </dl>
                  <ContactButtons phone={booking.technician.phone} />
                </>
              ) : (
                <p className="text-muted-foreground">
                  Not assigned yet.{' '}
                  <Link href={`/dispatch?bookingId=${booking.id}`} className="font-medium text-primary hover:underline">
                    Find a technician
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <dl className="space-y-2">
                <Row label="Estimate">{formatINR(booking.estimatedAmount?.amountMinor ?? 0)}</Row>
                <Row label="Final">
                  {booking.finalAmount?.amountMinor != null ? formatINR(booking.finalAmount.amountMinor) : 'Not set'}
                </Row>
              </dl>
            </CardContent>
          </Card>

          <BookingRepairPanel booking={booking} />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}
