/**
 * Static feature flag definitions. At runtime, flags will be hydrated from a
 * remote source (e.g. PostHog / LaunchDarkly / a `feature_flags` DB table)
 * and merged on top of these defaults.
 */
export const FEATURE_FLAGS = {
  WHATSAPP_BOOKING: { key: 'whatsapp.booking', defaultValue: false },
  TECHNICIAN_LIVE_TRACKING: { key: 'technician.live_tracking', defaultValue: true },
  DISPATCH_AUTO_ASSIGN: { key: 'dispatch.auto_assign', defaultValue: false },
  CUSTOMER_WALLET: { key: 'customer.wallet', defaultValue: false },
  AI_TRIAGE: { key: 'ai.triage', defaultValue: false },
  MULTI_CITY: { key: 'platform.multi_city', defaultValue: true },
  RAZORPAY_PAYMENTS: { key: 'payments.razorpay', defaultValue: true },
  STRIPE_PAYMENTS: { key: 'payments.stripe', defaultValue: false },
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]['key'];

export interface FeatureFlagContext {
  userId?: string;
  tenantId?: string;
  cityId?: string;
  role?: string;
}

export interface FeatureFlagProvider {
  isEnabled(key: FeatureFlagKey, context?: FeatureFlagContext): Promise<boolean>;
  getAll(context?: FeatureFlagContext): Promise<Record<FeatureFlagKey, boolean>>;
}
