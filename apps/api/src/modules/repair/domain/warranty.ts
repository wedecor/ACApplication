/**
 * Warranty helpers — repair guarantee windows, manufacturer / extended
 * warranty checks and AMC coverage matching. Pure functions.
 */

export const DEFAULT_REPAIR_WARRANTY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** completedAt + repairWarrantyDays (defaults to 30 when no catalog item). */
export function computeRepairWarrantyUntil(
  completedAt: Date,
  repairWarrantyDays: number | null | undefined,
): Date {
  const days =
    repairWarrantyDays != null && Number.isFinite(repairWarrantyDays) && repairWarrantyDays >= 0
      ? repairWarrantyDays
      : DEFAULT_REPAIR_WARRANTY_DAYS;
  return new Date(completedAt.getTime() + days * DAY_MS);
}

export function isWindowActive(until: Date | null | undefined, now: Date = new Date()): boolean {
  return !!until && until.getTime() > now.getTime();
}

const AC_FAMILY = new Set(['AC_REPAIR', 'AC_SERVICING', 'AC_INSTALLATION']);

/** AC repair / servicing / installation are one appliance family for coverage purposes. */
export function categoryFamily(category: string): string {
  return AC_FAMILY.has(category) ? 'AC' : category;
}

export function planCoversCategory(appliancesCovered: readonly string[], category: string): boolean {
  const family = categoryFamily(category);
  return appliancesCovered.some((c) => categoryFamily(c) === family);
}

/** True when the subscription's appliance snapshot explicitly lists this appliance id. */
export function snapshotIncludesAppliance(snapshot: unknown, applianceId: string): boolean {
  if (!Array.isArray(snapshot)) return false;
  return snapshot.some((entry) => {
    if (typeof entry === 'string') return entry === applianceId;
    if (entry && typeof entry === 'object') {
      const e = entry as { applianceId?: unknown; id?: unknown };
      return e.applianceId === applianceId || e.id === applianceId;
    }
    return false;
  });
}

export interface WarrantyWindow {
  active: boolean;
  until: Date | null;
}

export interface ApplianceWarrantyStatus {
  manufacturer: WarrantyWindow;
  extended: WarrantyWindow;
  repair: WarrantyWindow & { bookingId: string | null };
  amcCovered: boolean;
}

export function computeApplianceWarrantyStatus(input: {
  manufacturerWarrantyUntil: Date | null;
  extendedWarrantyUntil: Date | null;
  latestRepair: { bookingId: string; repairWarrantyUntil: Date | null } | null;
  amcCovered: boolean;
  now?: Date;
}): ApplianceWarrantyStatus {
  const now = input.now ?? new Date();
  const repairUntil = input.latestRepair?.repairWarrantyUntil ?? null;
  return {
    manufacturer: {
      active: isWindowActive(input.manufacturerWarrantyUntil, now),
      until: input.manufacturerWarrantyUntil,
    },
    extended: {
      active: isWindowActive(input.extendedWarrantyUntil, now),
      until: input.extendedWarrantyUntil,
    },
    repair: {
      active: isWindowActive(repairUntil, now),
      until: repairUntil,
      bookingId: input.latestRepair?.bookingId ?? null,
    },
    amcCovered: input.amcCovered,
  };
}
