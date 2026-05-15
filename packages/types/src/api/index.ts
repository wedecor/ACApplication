/**
 * API envelope contracts used by `apps/api` and consumed by all clients.
 * Standardised so the web/admin/mobile layers can share an HTTP client.
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
  requestId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown> | unknown[];
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ResponseMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface SortParam {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ListQuery extends PaginationParams {
  search?: string;
  sort?: SortParam[];
  filters?: Record<string, string | number | boolean | string[]>;
}

export interface PaginatedList<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** Canonical error codes used app-wide. Keep this in sync with the API. */
export const ApiErrorCode = {
  // 4xx
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  BAD_REQUEST: 'BAD_REQUEST',
  // 5xx
  INTERNAL: 'INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  // Domain-specific
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  PERMISSIONS_STALE: 'PERMISSIONS_STALE',
  BOOKING_NOT_ASSIGNABLE: 'BOOKING_NOT_ASSIGNABLE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
