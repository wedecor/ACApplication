/**
 * Lightweight analytics dispatcher for the customer app.
 *
 * Sends events to whichever native SDKs are configured in EAS builds
 * (Segment/Amplitude/Firebase). For dev/Expo Go we just log to the
 * console so the funnel can still be inspected.
 *
 * Screens import `track` and the {@link Events} enum so call sites stay
 * grep-able.
 */
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export const Events = {
  AppOpen: 'app_open',
  Screen: 'screen_view',
  LoginRequest: 'login_request_otp',
  LoginVerify: 'login_verify_otp',
  LoginSuccess: 'login_success',
  Logout: 'logout',

  BookingStart: 'booking_start',
  BookingStepView: 'booking_step_view',
  BookingPhotoUpload: 'booking_photo_upload',
  BookingSubmit: 'booking_submit',
  BookingSuccess: 'booking_success',
  BookingError: 'booking_error',
  BookingReschedule: 'booking_reschedule',
  BookingCancel: 'booking_cancel',

  TrackingOpen: 'tracking_open',
  TrackingCallTech: 'tracking_call_technician',
  TrackingWhatsAppTech: 'tracking_whatsapp_technician',

  PaymentStart: 'payment_start',
  PaymentSuccess: 'payment_success',
  PaymentFailed: 'payment_failed',

  AmcView: 'amc_view',
  AmcRenew: 'amc_renew',
  AmcPurchase: 'amc_purchase',

  NotificationOpen: 'notification_open',
  NotificationTap: 'notification_tap',

  SupportTicketOpen: 'support_ticket_open',
  SupportWhatsApp: 'support_whatsapp',
  SupportCall: 'support_call',

  ReviewSubmit: 'review_submit',
} as const;

export type AnalyticsEvent = (typeof Events)[keyof typeof Events];

type Props = Record<string, string | number | boolean | null | undefined>;

let userId: string | null = null;
let tenantId: string | null = null;

export function identifyUser(id: string | null, t?: string | null): void {
  userId = id;
  tenantId = t ?? null;
}

export function track(event: AnalyticsEvent | string, props?: Props): void {
  const payload = {
    event,
    userId,
    tenantId,
    platform: Platform.OS,
    appVersion: Application.nativeApplicationVersion ?? null,
    ts: new Date().toISOString(),
    ...(props ?? {}),
  };
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, payload);
  }
  // Native SDK fanout would hook here in EAS builds.
}

export function trackScreen(screen: string, props?: Props): void {
  track(Events.Screen, { screen, ...(props ?? {}) });
}
