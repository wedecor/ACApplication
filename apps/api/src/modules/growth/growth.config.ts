/**
 * Growth tunables. Read from the environment with safe defaults so the module
 * works out of the box; none of these are secrets.
 *
 *   REFERRAL_REWARD_MINOR          reward value recorded on the referral (default ₹100 = 10000)
 *   REFERRAL_REWARD_POINTS         loyalty points credited to the referrer (default 100)
 *   LOYALTY_POINTS_PER_100         points earned per ₹100 of paid invoice value (default 1)
 *   REVIEW_REQUEST_DELAY_MINUTES   delay after completion before asking for a review (default 60)
 *   REVIEW_REQUEST_CHANNEL         WHATSAPP | SMS (default WHATSAPP)
 *   GOOGLE_REVIEW_URL              public review link sent to 4–5 star raters (optional)
 *   GROWTH_SCHEDULER_DISABLED      '1' disables growth crons
 */
import { NotificationChannel } from '@ac/types';

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : fallback;
}

export interface GrowthConfig {
  referralRewardMinor: number;
  referralRewardPoints: number;
  loyaltyPointsPer100: number;
  reviewRequestDelayMinutes: number;
  reviewRequestChannel: NotificationChannel;
  googleReviewUrl: string | null;
  schedulerDisabled: boolean;
}

export function loadGrowthConfig(): GrowthConfig {
  const channel = (process.env.REVIEW_REQUEST_CHANNEL ?? 'WHATSAPP').toUpperCase();
  return {
    referralRewardMinor: intEnv('REFERRAL_REWARD_MINOR', 10_000),
    referralRewardPoints: intEnv('REFERRAL_REWARD_POINTS', 100),
    loyaltyPointsPer100: intEnv('LOYALTY_POINTS_PER_100', 1),
    reviewRequestDelayMinutes: intEnv('REVIEW_REQUEST_DELAY_MINUTES', 60),
    reviewRequestChannel:
      channel === NotificationChannel.SMS ? NotificationChannel.SMS : NotificationChannel.WHATSAPP,
    googleReviewUrl: process.env.GOOGLE_REVIEW_URL?.trim() || null,
    schedulerDisabled: process.env.GROWTH_SCHEDULER_DISABLED === '1',
  };
}

export const GROWTH_CONFIG = Symbol('GROWTH_CONFIG');
