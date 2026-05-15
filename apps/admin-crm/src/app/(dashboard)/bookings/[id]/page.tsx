'use client';

import { BookingPaymentStatus, BookingStatus } from '@ac/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { format } from 'date-fns';
import { ArrowLeft, MapPin, Phone, User as UserIcon, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Timeline } from '@/components/common/timeline';
import {
  BookingPaymentBadge,
  BookingStatusBadge,
} from '@/components/bookings/booking-status-badge';
import { BookingStatusActions } from '@/components/bookings/booking-status-actions';
import { OtpVerifyForm } from '@/components/bookings/otp-verify-form';
import { RescheduleForm } from '@/components/bookings/reschedule-form';
import { useBooking, useBookingActivities } from '@/hooks/use-bookings';
import { useRealtime } from '@/hooks/use-realtime';

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
      <Link href="/bookings" className="text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="inline size-4" /> Back to bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {booking.customer.fullName}
            </h1>
            <BookingStatusBadge status={booking.status as BookingStatus} />
            <BookingPaymentBadge status={booking.paymentStatus as BookingPaymentStatus} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{booking.code}</p>
        </div>
        <BookingStatusActions id={booking.id} current={booking.status as BookingStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="mt-4">
              <Timeline entries={activities as never} />
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
                    current={booking.scheduledAt as unknown as string}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="details" className="mt-4 space-y-3">
              <DetailRow label="Issue">{booking.issueDescription ?? '—'}</DetailRow>
              <DetailRow label="Appliance">
                {[booking.applianceType, booking.applianceBrand].filter(Boolean).join(' · ') || '—'}
              </DetailRow>
              <DetailRow label="Service type">{booking.serviceType ?? '—'}</DetailRow>
              <DetailRow label="Address">
                {[booking.address?.line1, booking.address?.line2, booking.address?.pincode].filter(Boolean).join(', ') || '—'}
              </DetailRow>
              {booking.lead ? (
                <DetailRow label="Source lead">
                  <Link href={`/leads/${booking.lead.id}`} className="text-primary hover:underline">
                    {booking.lead.code}
                  </Link>
                </DetailRow>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                {format(new Date(booking.scheduledAt as unknown as string), 'EEE, dd MMM yyyy · HH:mm')}
              </div>
              {booking.scheduledTimeSlot ? (
                <div className="text-xs text-muted-foreground">{booking.scheduledTimeSlot}</div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row icon={<UserIcon className="size-4" />} value={booking.customer.fullName} />
              <Row icon={<Phone className="size-4" />} value={booking.customer.phone} />
              <Row icon={<MapPin className="size-4" />} value={booking.city.name} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Technician</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {booking.technician ? (
                <>
                  <Row icon={<Wrench className="size-4" />} value={booking.technician.fullName} />
                  <Row icon={<Phone className="size-4" />} value={booking.technician.phone} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Not assigned yet</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Estimate" value={formatINR(booking.estimatedAmount?.amountMinor ?? 0)} />
              <Separator />
              <Row
                label="Final"
                value={formatINR(booking.finalAmount?.amountMinor ?? null)}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      {label ? <span className="text-xs uppercase text-muted-foreground">{label}</span> : null}
      <span className="ml-auto">{value}</span>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-md border bg-card p-3 text-sm">
      <span className="col-span-1 text-xs uppercase text-muted-foreground">{label}</span>
      <span className="col-span-2">{children}</span>
    </div>
  );
}
