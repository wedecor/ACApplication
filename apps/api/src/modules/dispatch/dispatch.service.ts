import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type BookingId,
  BookingPriority,
  BookingStatus,
  DispatchAlertKind,
  DispatchDecision,
  DomainEventName,
  type ServiceCategory,
  TERMINAL_BOOKING_STATUSES,
  type TechnicianId,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';
import type { Prisma, Technician } from '@ac/database';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  type AssignmentCandidate,
  AssignmentService,
} from '../assignment/assignment.service';
import { BookingsService } from '../bookings/bookings.service';
import { RoutingService } from '../routing/routing.service';
import { TrackingService } from '../tracking/tracking.service';

/**
 * Smart dispatch engine. Extends the base AssignmentService scoring with:
 *   - ETA + traffic-aware adjustment (via RoutingService),
 *   - response-time bonus (techs who recently accepted quickly),
 *   - repeat-customer preference (prior tech for same customer),
 *   - priority weight (EMERGENCY > PRIORITY > STANDARD),
 *   - exclusion of techs who recently rejected the job.
 *
 * Every decision is persisted to `dispatch_assignments` so ops can audit
 * "why this tech for this job" and feed the scoring algorithm with feedback
 * over time.
 */
const RECOMMENDATION_LIMIT = 5;
const RECENT_REJECT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESPONSE_BONUS_CAP = 15;
const REPEAT_CUSTOMER_BONUS = 10;
const PRIORITY_WEIGHT: Record<BookingPriority, number> = {
  STANDARD: 0,
  PRIORITY: 8,
  EMERGENCY: 18,
};

export interface DispatchRecommendation {
  technicianId: string;
  fullName: string;
  status: string;
  rating: number;
  activeJobs: number;
  distanceKm: number | null;
  etaMin: number | null;
  trafficEtaMin: number | null;
  score: number;
  breakdown: {
    base: number;
    eta: number;
    responseTime: number;
    repeatCustomer: number;
    priorityBoost: number;
  };
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly bookings: BookingsService,
    private readonly routing: RoutingService,
    private readonly _tracking: TrackingService,
    private readonly events: DomainEventBus,
  ) {
    void this._tracking;
  }

  /**
   * Compute (and persist as RECOMMENDED rows) the top-N candidates for a
   * booking. Used by the dispatcher control center to populate the right-rail
   * recommendations panel.
   */
  async recommend(
    actor: AuthPrincipal,
    bookingId: string,
  ): Promise<DispatchRecommendation[]> {
    const booking = await this.loadBooking(actor, bookingId);
    if (TERMINAL_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
      return [];
    }

    const excluded = await this.recentlyRejectedTechIds(bookingId);
    const candidates = await this.assignment.findCandidates({
      tenantId: actor.tenantId,
      cityId: booking.cityId,
      category: booking.category as ServiceCategory,
      geo: this.geoOf(booking),
      scheduledAt: booking.scheduledAt,
      excludeTechnicianIds: Array.from(excluded),
      limit: RECOMMENDATION_LIMIT,
    });
    if (candidates.length === 0) return [];

    const enriched = await this.enrichCandidates(candidates, booking);

    // Persist as RECOMMENDED — clears any previous recs for this booking first.
    await this.prisma.client.dispatchAssignment.deleteMany({
      where: { bookingId, decision: DispatchDecision.RECOMMENDED },
    });
    await this.prisma.client.dispatchAssignment.createMany({
      data: enriched.map<Prisma.DispatchAssignmentCreateManyInput>((c) => ({
        tenantId: actor.tenantId,
        bookingId,
        technicianId: c.technicianId,
        decision: DispatchDecision.RECOMMENDED,
        score: c.score,
        breakdown: c.breakdown as never,
        distanceKm: c.distanceKm,
        etaMin: c.etaMin,
        actorUserId: actor.userId,
      })),
    });

    return enriched;
  }

  /** POST /dispatch/auto-assign/:bookingId */
  async autoAssign(actor: AuthPrincipal, bookingId: string) {
    const booking = await this.loadBooking(actor, bookingId);
    if (TERMINAL_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
      throw new ForbiddenException('Cannot assign a closed booking');
    }
    if (booking.technicianId) {
      throw new ConflictException('Booking already has a technician — reassign instead.');
    }

    const excluded = await this.recentlyRejectedTechIds(bookingId);
    const candidates = await this.assignment.findCandidates({
      tenantId: actor.tenantId,
      cityId: booking.cityId,
      category: booking.category as ServiceCategory,
      geo: this.geoOf(booking),
      scheduledAt: booking.scheduledAt,
      excludeTechnicianIds: Array.from(excluded),
      limit: RECOMMENDATION_LIMIT,
    });
    if (candidates.length === 0) {
      await this.raiseAlert({
        tenantId: actor.tenantId,
        cityId: booking.cityId,
        kind: DispatchAlertKind.NO_CANDIDATES,
        severity: 'critical',
        message: `No technician available for booking ${booking.code}`,
        resourceType: 'Booking',
        resourceId: bookingId,
      });
      this.events.publish(DomainEventName.DispatchNoCandidates, {
        bookingId: bookingId as BookingId,
        cityId: booking.cityId,
      });
      throw new ConflictException({
        message: 'No suitable technician available',
        code: 'NO_TECHNICIAN_AVAILABLE',
      });
    }

    const enriched = await this.enrichCandidates(candidates, booking);
    const top = enriched[0]!;
    if (top.score < this.assignment.MIN_AUTO_SCORE) {
      // Surface as recommendations instead of forcing a low-confidence pick.
      throw new ConflictException({
        message: 'Top candidate below auto-pick confidence — dispatcher review required.',
        code: 'LOW_CONFIDENCE',
        recommendations: enriched,
      });
    }

    // Delegate to BookingsService to mutate the row + emit the canonical
    // booking events — this keeps a single source of truth for transitions.
    await this.bookings.assignTechnician(actor, bookingId, {
      technicianId: top.technicianId,
      reason: 'Auto-assigned by dispatch engine',
    });

    const record = await this.recordDecision({
      tenantId: actor.tenantId,
      bookingId,
      technicianId: top.technicianId,
      decision: DispatchDecision.AUTO_ASSIGNED,
      score: top.score,
      breakdown: top.breakdown,
      distanceKm: top.distanceKm,
      etaMin: top.etaMin,
      actorUserId: actor.userId,
    });

    this.events.publish(DomainEventName.DispatchAutoAssigned, {
      bookingId: bookingId as BookingId,
      technicianId: top.technicianId as TechnicianId,
      score: top.score,
      assignmentId: record.id as never,
    });

    return { booking: bookingId, assignment: record, recommendations: enriched };
  }

  /** POST /dispatch/manual-assign */
  async manualAssign(
    actor: AuthPrincipal,
    input: { bookingId: string; technicianId: string; reason?: string },
  ) {
    const booking = await this.loadBooking(actor, input.bookingId);
    await this.bookings.assignTechnician(actor, input.bookingId, {
      technicianId: input.technicianId,
      reason: input.reason ?? 'Manually assigned by dispatcher',
    });

    const tech = await this.prisma.client.technician.findFirst({
      where: { id: input.technicianId, tenantId: actor.tenantId },
    });
    const eta = await this.estimateEta(booking, tech).catch(() => null);

    const record = await this.recordDecision({
      tenantId: actor.tenantId,
      bookingId: input.bookingId,
      technicianId: input.technicianId,
      decision: DispatchDecision.MANUAL_ASSIGNED,
      etaMin: eta?.etaMin ?? null,
      distanceKm: eta?.distanceKm ?? null,
      actorUserId: actor.userId,
      reason: input.reason,
    });

    this.events.publish(DomainEventName.DispatchManualAssigned, {
      bookingId: input.bookingId as BookingId,
      technicianId: input.technicianId as TechnicianId,
      assignmentId: record.id as never,
    });
    return record;
  }

  /** POST /dispatch/reassign */
  async reassign(
    actor: AuthPrincipal,
    input: { bookingId: string; toTechnicianId?: string; autoPick?: boolean; reason?: string },
  ) {
    const booking = await this.loadBooking(actor, input.bookingId);
    if (TERMINAL_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
      throw new ForbiddenException('Cannot reassign a closed booking');
    }

    const previousTechId = booking.technicianId;
    let newTechId = input.toTechnicianId;

    if (!newTechId) {
      if (!input.autoPick) throw new ConflictException('toTechnicianId or autoPick is required');
      const excluded = await this.recentlyRejectedTechIds(input.bookingId);
      if (previousTechId) excluded.add(previousTechId);
      const candidates = await this.assignment.findCandidates({
        tenantId: actor.tenantId,
        cityId: booking.cityId,
        category: booking.category as ServiceCategory,
        geo: this.geoOf(booking),
        scheduledAt: booking.scheduledAt,
        excludeTechnicianIds: Array.from(excluded),
        limit: 1,
      });
      if (candidates.length === 0) {
        throw new ConflictException('No alternate technician available');
      }
      newTechId = candidates[0]!.technician.id;
    }

    await this.bookings.assignTechnician(actor, input.bookingId, {
      technicianId: newTechId,
      reason: input.reason ?? 'Reassigned by dispatcher',
    });

    // Find the most recent active assignment row to chain `replacesId` to.
    const previous = await this.prisma.client.dispatchAssignment.findFirst({
      where: {
        bookingId: input.bookingId,
        decision: { in: [DispatchDecision.AUTO_ASSIGNED, DispatchDecision.MANUAL_ASSIGNED] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const record = await this.recordDecision({
      tenantId: actor.tenantId,
      bookingId: input.bookingId,
      technicianId: newTechId,
      decision: DispatchDecision.REASSIGNED,
      reason: input.reason,
      replacesId: previous?.id,
      actorUserId: actor.userId,
    });

    this.events.publish(DomainEventName.DispatchReassigned, {
      bookingId: input.bookingId as BookingId,
      fromTechnicianId: (previousTechId ?? null) as TechnicianId | null,
      toTechnicianId: newTechId as TechnicianId,
      reason: input.reason ?? null,
      assignmentId: record.id as never,
    });
    return record;
  }

  /** Technician rejects an assignment — recorded so future scoring penalises. */
  async rejectByTechnician(
    actor: AuthPrincipal,
    input: { bookingId: string; technicianUserId: string; reason?: string },
  ) {
    const tech = await this.prisma.client.technician.findFirst({
      where: { userId: input.technicianUserId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!tech) throw new NotFoundException('Technician not found');
    await this.recordDecision({
      tenantId: actor.tenantId,
      bookingId: input.bookingId,
      technicianId: tech.id,
      decision: DispatchDecision.REJECTED_BY_TECHNICIAN,
      reason: input.reason,
      actorUserId: input.technicianUserId,
    });
    this.events.publish(DomainEventName.TechnicianJobRejected, {
      technicianId: tech.id as TechnicianId,
      bookingId: input.bookingId as BookingId,
      reason: input.reason ?? null,
    });
  }

  /** Dispatch alert acknowledgement (dashboard widget). */
  async acknowledgeAlert(actor: AuthPrincipal, alertId: string, note?: string) {
    const alert = await this.prisma.client.dispatchEvent.findFirst({
      where: { id: alertId, tenantId: actor.tenantId },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.acknowledgedAt) return alert;

    const updated = await this.prisma.client.dispatchEvent.update({
      where: { id: alertId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: actor.userId,
        metadata: {
          ...((alert.metadata as object) ?? {}),
          ackNote: note ?? null,
        } as never,
      },
    });
    this.events.publish(DomainEventName.DispatchAlertAcknowledged, {
      alertId,
      acknowledgedBy: actor.userId as never,
    });
    return updated;
  }

  /** Unassigned-queue feed for the dispatcher dashboard. */
  unassignedQueue(tenantId: string, cityId?: string, limit = 50) {
    return this.prisma.client.booking.findMany({
      where: {
        tenantId,
        deletedAt: null,
        technicianId: null,
        status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] },
        ...(cityId ? { cityId } : {}),
      },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
      take: limit,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        city: { select: { id: true, name: true } },
      },
    });
  }

  /** Open dispatch alerts for the operational alerts panel. */
  openAlerts(tenantId: string, cityId?: string) {
    return this.prisma.client.dispatchEvent.findMany({
      where: { tenantId, acknowledgedAt: null, ...(cityId ? { cityId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        technician: { select: { id: true, fullName: true } },
      },
      take: 50,
    });
  }

  /** Recent dispatch decisions for the live activity feed. */
  recentDecisions(tenantId: string, cityId?: string, limit = 50) {
    return this.prisma.client.dispatchAssignment.findMany({
      where: { tenantId, ...(cityId ? {} : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        technician: { select: { id: true, fullName: true } },
      },
    });
  }

  /** Raise a dispatch alert + emit + persist. Idempotent on (resourceId, kind). */
  async raiseAlert(input: {
    tenantId: string;
    cityId?: string | null;
    kind: DispatchAlertKind;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    resourceType?: string;
    resourceId?: string;
    technicianId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    // Coalesce: don't create a duplicate alert if one is still unacknowledged.
    const existing = await this.prisma.client.dispatchEvent.findFirst({
      where: {
        tenantId: input.tenantId,
        kind: input.kind,
        resourceId: input.resourceId,
        acknowledgedAt: null,
      },
    });
    if (existing) return existing;

    const alert = await this.prisma.client.dispatchEvent.create({
      data: {
        tenantId: input.tenantId,
        cityId: input.cityId ?? null,
        kind: input.kind,
        severity: input.severity,
        message: input.message,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        technicianId: input.technicianId ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    });
    this.events.publish(DomainEventName.DispatchAlertRaised, {
      alertId: alert.id,
      kind: input.kind,
      severity: input.severity,
      technicianId: (input.technicianId ?? null) as TechnicianId | null,
      bookingId: (input.resourceType === 'Booking' ? input.resourceId ?? null : null) as BookingId | null,
      cityId: input.cityId ?? null,
      message: input.message,
    });
    return alert;
  }

  // ---------------- helpers ----------------

  private async loadBooking(actor: AuthPrincipal, bookingId: string) {
    const b = await this.prisma.client.booking.findFirst({
      where: { id: bookingId, tenantId: actor.tenantId, deletedAt: null },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  private geoOf(booking: { geoLatitude: number | null; geoLongitude: number | null }) {
    return booking.geoLatitude != null && booking.geoLongitude != null
      ? { latitude: booking.geoLatitude, longitude: booking.geoLongitude }
      : null;
  }

  private async recentlyRejectedTechIds(bookingId: string): Promise<Set<string>> {
    const cutoff = new Date(Date.now() - RECENT_REJECT_WINDOW_MS);
    const rows = await this.prisma.client.dispatchAssignment.findMany({
      where: {
        bookingId,
        decision: DispatchDecision.REJECTED_BY_TECHNICIAN,
        createdAt: { gte: cutoff },
      },
      select: { technicianId: true },
    });
    return new Set(rows.map((r) => r.technicianId));
  }

  /**
   * Recompute candidate scores with routing + priority + repeat-customer
   * bonuses. We deliberately keep the base AssignmentService stateless and
   * apply contextual adjustments here.
   */
  private async enrichCandidates(
    candidates: AssignmentCandidate[],
    booking: {
      customerId: string;
      priority: BookingPriority;
      geoLatitude: number | null;
      geoLongitude: number | null;
    },
  ): Promise<DispatchRecommendation[]> {
    const geo = this.geoOf(booking);
    const techs = await this.prisma.client.technician.findMany({
      where: { id: { in: candidates.map((c) => c.technician.id) } },
      select: { id: true, fullName: true, status: true, rating: true },
    });
    const techMap = new Map(techs.map((t) => [t.id, t]));

    const repeatTechIds = await this.repeatTechIdsForCustomer(booking.customerId);

    // Response-time bonus — based on each tech's avg response time today.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aggregates = await this.prisma.client.technicianAvailability.findMany({
      where: {
        technicianId: { in: candidates.map((c) => c.technician.id) },
        date: today,
      },
      select: { technicianId: true, avgResponseTimeMin: true },
    });
    const aggMap = new Map(aggregates.map((a) => [a.technicianId, a.avgResponseTimeMin]));

    const out: DispatchRecommendation[] = [];
    for (const c of candidates) {
      const tech = techMap.get(c.technician.id)!;
      let etaMin: number | null = null;
      let trafficEtaMin: number | null = null;
      let etaScore = 0;
      if (geo && c.technician.lastLatitude != null && c.technician.lastLongitude != null) {
        const est = await this.routing
          .estimate(
            { latitude: c.technician.lastLatitude, longitude: c.technician.lastLongitude },
            geo,
          )
          .catch(() => null);
        if (est) {
          etaMin = est.durationS / 60;
          trafficEtaMin = est.trafficDurationS != null ? est.trafficDurationS / 60 : null;
          // Linear decay: 0 min → full points, 45+ min → 0.
          const minutes = trafficEtaMin ?? etaMin;
          etaScore = Math.max(0, Math.round(20 * (1 - Math.min(minutes, 45) / 45)));
        }
      }

      const responseBonus = (() => {
        const avg = aggMap.get(c.technician.id);
        if (avg == null) return 0;
        // <5min response → max bonus, ≥30min → none.
        return Math.max(0, Math.round(RESPONSE_BONUS_CAP * (1 - Math.min(avg, 30) / 30)));
      })();

      const repeatBonus = repeatTechIds.has(c.technician.id) ? REPEAT_CUSTOMER_BONUS : 0;
      const priorityBoost = PRIORITY_WEIGHT[booking.priority] ?? 0;

      const score = c.score + etaScore + responseBonus + repeatBonus + priorityBoost;

      out.push({
        technicianId: c.technician.id,
        fullName: tech.fullName,
        status: tech.status,
        rating: tech.rating,
        activeJobs: c.activeJobs,
        distanceKm: c.distanceKm,
        etaMin,
        trafficEtaMin,
        score,
        breakdown: {
          base: c.score,
          eta: etaScore,
          responseTime: responseBonus,
          repeatCustomer: repeatBonus,
          priorityBoost,
        },
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  private async repeatTechIdsForCustomer(customerId: string): Promise<Set<string>> {
    const recent = await this.prisma.client.booking.findMany({
      where: { customerId, technicianId: { not: null }, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: { technicianId: true },
    });
    return new Set(recent.map((r) => r.technicianId!).filter(Boolean));
  }

  private async estimateEta(
    booking: { geoLatitude: number | null; geoLongitude: number | null },
    tech: Pick<Technician, 'lastLatitude' | 'lastLongitude'> | null,
  ): Promise<{ etaMin: number; distanceKm: number } | null> {
    const dest = this.geoOf(booking);
    if (!dest || !tech?.lastLatitude || !tech?.lastLongitude) return null;
    const est = await this.routing.estimate(
      { latitude: tech.lastLatitude, longitude: tech.lastLongitude },
      dest,
    );
    return { etaMin: est.durationS / 60, distanceKm: est.distanceM / 1000 };
  }

  private async recordDecision(input: {
    tenantId: string;
    bookingId: string;
    technicianId: string;
    decision: DispatchDecision;
    score?: number;
    breakdown?: Record<string, number>;
    distanceKm?: number | null;
    etaMin?: number | null;
    reason?: string | null | undefined;
    replacesId?: string | null;
    actorUserId?: string | null;
  }) {
    return this.prisma.client.dispatchAssignment.create({
      data: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        technicianId: input.technicianId,
        decision: input.decision,
        score: input.score ?? null,
        breakdown: (input.breakdown ?? {}) as never,
        distanceKm: input.distanceKm ?? null,
        etaMin: input.etaMin ?? null,
        reason: input.reason ?? null,
        replacesId: input.replacesId ?? null,
        actorUserId: input.actorUserId ?? null,
      },
    });
  }
}
