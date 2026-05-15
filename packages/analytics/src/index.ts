/**
 * Provider-agnostic analytics façade. Swap PostHog/Mixpanel/Segment behind
 * `AnalyticsProvider` without touching call sites.
 */

export interface AnalyticsContext {
  userId?: string;
  tenantId?: string;
  cityId?: string;
  role?: string;
}

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsProvider {
  identify(userId: string, traits?: EventProperties): Promise<void> | void;
  track(event: string, properties?: EventProperties, context?: AnalyticsContext): Promise<void> | void;
  page(name: string, properties?: EventProperties): Promise<void> | void;
  reset(): Promise<void> | void;
}

/** No-op provider — default for tests & local dev. */
export class NoopAnalyticsProvider implements AnalyticsProvider {
  identify(): void {}
  track(): void {}
  page(): void {}
  reset(): void {}
}

/** Stdout provider — useful when debugging locally. */
export class ConsoleAnalyticsProvider implements AnalyticsProvider {
  identify(userId: string, traits?: EventProperties): void {
    console.info('[analytics] identify', { userId, traits });
  }
  track(event: string, properties?: EventProperties, context?: AnalyticsContext): void {
    console.info('[analytics] track', { event, properties, context });
  }
  page(name: string, properties?: EventProperties): void {
    console.info('[analytics] page', { name, properties });
  }
  reset(): void {
    console.info('[analytics] reset');
  }
}

/** Canonical event taxonomy. Add new events here so all clients agree. */
export const AnalyticsEvent = {
  UserSignedUp: 'user.signed_up',
  UserLoggedIn: 'user.logged_in',
  BookingCreated: 'booking.created',
  BookingCompleted: 'booking.completed',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  TechnicianAssigned: 'technician.assigned',
} as const;
export type AnalyticsEvent = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export class Analytics {
  constructor(private readonly provider: AnalyticsProvider = new NoopAnalyticsProvider()) {}

  identify(userId: string, traits?: EventProperties) {
    return this.provider.identify(userId, traits);
  }
  track(event: AnalyticsEvent | string, properties?: EventProperties, context?: AnalyticsContext) {
    return this.provider.track(event, properties, context);
  }
  page(name: string, properties?: EventProperties) {
    return this.provider.page(name, properties);
  }
  reset() {
    return this.provider.reset();
  }
}
