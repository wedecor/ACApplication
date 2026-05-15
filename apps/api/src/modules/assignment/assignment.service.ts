import { Injectable, Logger } from '@nestjs/common';
import {
  DISPATCHABLE_TECHNICIAN_STATUSES,
  type ServiceCategory,
  TechnicianStatus,
} from '@ac/types';
import type { Prisma, Technician } from '@ac/database';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Tunable weights for the scoring algorithm. Sum should remain ≈ 100 for
 * easy interpretation. Tweak these per market without code changes via a
 * future feature-flag hook.
 */
const WEIGHTS = {
  skillMatch: 40,
  proximity: 25,
  workload: 20,
  rating: 15,
} as const;

const MAX_DISTANCE_KM = 25;

export interface AssignmentCandidate {
  technician: Technician;
  score: number;
  distanceKm: number | null;
  activeJobs: number;
  /** Per-factor breakdown so the dispatcher UI can explain "why this tech". */
  breakdown: {
    skillMatch: number;
    proximity: number;
    workload: number;
    rating: number;
  };
}

export interface FindCandidatesInput {
  tenantId: string;
  cityId: string;
  category: ServiceCategory;
  /** Service location — used for distance scoring when available. */
  geo?: { latitude: number; longitude: number } | null;
  /** Scheduled time of the job; technicians with overlapping jobs are excluded. */
  scheduledAt?: Date;
  /** Hard exclude (e.g. a tech who explicitly opted out of this job). */
  excludeTechnicianIds?: string[];
  limit?: number;
}

/**
 * Smart technician-assignment engine.
 *
 *   • Hard filters: same city, AVAILABLE status, has the required skill,
 *     not in the exclusion set, no scheduled conflict.
 *   • Soft scoring: weighted sum of skill-match, proximity, workload, rating.
 *
 * Returns a ranked list of candidates; callers either auto-pick #1 (when the
 * top score clears `MIN_AUTO_SCORE`) or surface the list to a dispatcher.
 */
@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);
  readonly MIN_AUTO_SCORE = 55;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns ranked candidates. Empty array means no eligible tech and the
   * dispatcher must intervene (or we fall back to overflow city).
   */
  async findCandidates(input: FindCandidatesInput): Promise<AssignmentCandidate[]> {
    const where: Prisma.TechnicianWhereInput = {
      tenantId: input.tenantId,
      cityId: input.cityId,
      status: { in: Array.from(DISPATCHABLE_TECHNICIAN_STATUSES) as TechnicianStatus[] },
      skills: { has: input.category },
      deletedAt: null,
      ...(input.excludeTechnicianIds?.length
        ? { id: { notIn: input.excludeTechnicianIds } }
        : {}),
    };

    const techs = await this.prisma.client.technician.findMany({
      where,
      take: 50,
    });

    if (techs.length === 0) {
      this.logger.debug({ cityId: input.cityId }, 'No eligible technicians found');
      return [];
    }

    // Active-jobs count per tech (over the scheduledAt ± 3h window).
    const windowStart = input.scheduledAt
      ? new Date(input.scheduledAt.getTime() - 3 * 60 * 60 * 1000)
      : new Date();
    const windowEnd = input.scheduledAt
      ? new Date(input.scheduledAt.getTime() + 3 * 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const conflicts = await this.prisma.client.booking.groupBy({
      by: ['technicianId'],
      _count: { _all: true },
      where: {
        technicianId: { in: techs.map((t) => t.id) },
        status: { in: ['ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', 'WAITING_PARTS'] },
        scheduledAt: { gte: windowStart, lt: windowEnd },
        deletedAt: null,
      },
    });
    const loadByTech = new Map(conflicts.map((c) => [c.technicianId ?? '', c._count._all]));

    const ranked: AssignmentCandidate[] = techs.map((tech) => {
      const activeJobs = loadByTech.get(tech.id) ?? 0;

      const skillMatch = WEIGHTS.skillMatch; // hard filter — always max for survivors
      const proximity = this.scoreProximity(tech, input.geo);
      const workload = this.scoreWorkload(activeJobs);
      const rating = this.scoreRating(tech.rating);

      const score = skillMatch + proximity + workload + rating;
      const distanceKm = this.haversineKm(tech, input.geo);

      return {
        technician: tech,
        score,
        distanceKm,
        activeJobs,
        breakdown: { skillMatch, proximity, workload, rating },
      };
    });

    // Highest score first; deterministic tiebreaker on rating, then id.
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.technician.rating !== a.technician.rating) {
        return b.technician.rating - a.technician.rating;
      }
      return a.technician.id.localeCompare(b.technician.id);
    });

    return ranked.slice(0, input.limit ?? 10);
  }

  /**
   * Convenience: pick the single best candidate, or null if no candidate
   * clears the auto-pick threshold. Callers that want manual review pass
   * `requireAutoPick = false`.
   */
  async pickBest(
    input: FindCandidatesInput,
    requireAutoPick = true,
  ): Promise<AssignmentCandidate | null> {
    const candidates = await this.findCandidates({ ...input, limit: 1 });
    const top = candidates[0];
    if (!top) return null;
    if (requireAutoPick && top.score < this.MIN_AUTO_SCORE) return null;
    return top;
  }

  // -------------- scoring helpers --------------

  private scoreProximity(
    tech: Technician,
    geo: FindCandidatesInput['geo'],
  ): number {
    const d = this.haversineKm(tech, geo);
    if (d === null) return WEIGHTS.proximity * 0.5; // unknown distance → neutral
    if (d <= 2) return WEIGHTS.proximity;
    if (d >= MAX_DISTANCE_KM) return 0;
    // Linear decay from full points at 2km to 0 at MAX_DISTANCE_KM.
    const ratio = 1 - (d - 2) / (MAX_DISTANCE_KM - 2);
    return Math.round(WEIGHTS.proximity * ratio);
  }

  private scoreWorkload(activeJobs: number): number {
    if (activeJobs === 0) return WEIGHTS.workload;
    if (activeJobs === 1) return Math.round(WEIGHTS.workload * 0.6);
    if (activeJobs === 2) return Math.round(WEIGHTS.workload * 0.3);
    return 0;
  }

  private scoreRating(rating: number): number {
    // 0 - 5 stars → 0 - WEIGHTS.rating.
    const clamped = Math.max(0, Math.min(5, rating));
    return Math.round((clamped / 5) * WEIGHTS.rating);
  }

  private haversineKm(
    tech: Pick<Technician, 'lastLatitude' | 'lastLongitude'>,
    geo: FindCandidatesInput['geo'],
  ): number | null {
    if (!geo || tech.lastLatitude == null || tech.lastLongitude == null) return null;
    const toRad = (n: number) => (n * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(geo.latitude - tech.lastLatitude);
    const dLon = toRad(geo.longitude - tech.lastLongitude);
    const lat1 = toRad(tech.lastLatitude);
    const lat2 = toRad(geo.latitude);
    const a =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
