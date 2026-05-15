/**
 * Branded primitive types — these prevent accidental mixing of e.g. UserId vs.
 * CustomerId at compile time while staying string at runtime.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type CustomerId = Brand<string, 'CustomerId'>;
export type TechnicianId = Brand<string, 'TechnicianId'>;
export type BookingId = Brand<string, 'BookingId'>;
export type InvoiceId = Brand<string, 'InvoiceId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type CityId = Brand<string, 'CityId'>;
export type TenantId = Brand<string, 'TenantId'>;

/** Geographic coordinates (WGS84). */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Indian-formatted address (extensible per market). */
export interface Address {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  location?: GeoPoint;
}

/** Money is always stored as integer minor units (paise) to avoid float drift. */
export interface Money {
  /** Amount in minor units, e.g. 19999 = ₹199.99 */
  amountMinor: number;
  currency: 'INR' | 'USD' | 'AED' | 'GBP';
}

/** Phone numbers stored in E.164 format. */
export type PhoneNumberE164 = Brand<string, 'PhoneNumberE164'>;

/** ISO-8601 timestamp string. */
export type IsoDateString = Brand<string, 'IsoDateString'>;

export interface AuditFields {
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  createdBy?: UserId | null;
  updatedBy?: UserId | null;
  deletedAt?: IsoDateString | null;
  deletedBy?: UserId | null;
}

export type Nullable<T> = T | null;
export type Maybe<T> = T | null | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
