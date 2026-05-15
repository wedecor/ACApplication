import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  canTransitionLead,
  DomainEventName,
  type LeadId,
  type LeadStatus,
  TERMINAL_LEAD_STATUSES,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { AddLeadNoteDto } from './dto/add-note.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ChangeLeadStatusDto } from './dto/change-status.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsRepository } from './leads.repository';

/**
 * Lead orchestrator — owns the state machine, audit/timeline writes and
 * domain-event emission. No Prisma calls outside the repository.
 */
@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly repo: LeadsRepository,
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly activity: ActivityService,
  ) {}

  async create(actor: AuthPrincipal, dto: CreateLeadDto) {
    // Idempotency on externalRef — Ads / WhatsApp can deliver-at-least-once.
    if (dto.externalRef) {
      const existing = await this.repo.findByExternalRef(actor.tenantId, dto.externalRef);
      if (existing) return existing;
    }

    // Soft duplicate detection — same phone within 24h.
    const dupe = await this.repo.findRecentDuplicate(actor.tenantId, dto.phone);
    if (dupe) {
      this.logger.debug({ leadId: dupe.id, phone: dto.phone }, 'Duplicate lead suppressed');
      throw new ConflictException({
        message: 'A recent lead with this phone already exists',
        code: 'DUPLICATE_LEAD',
        leadId: dupe.id,
      });
    }

    const code = await this.repo.nextCode(actor.tenantId);

    const lead = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.create(
        {
          code,
          tenantId: actor.tenantId,
          customerName: dto.customerName,
          phone: dto.phone,
          whatsappNumber: dto.whatsappNumber ?? null,
          email: dto.email ?? null,
          source: dto.source,
          applianceType: dto.applianceType ?? null,
          applianceBrand: dto.applianceBrand ?? null,
          issueDescription: dto.issueDescription ?? null,
          addressLine1: dto.addressLine1 ?? null,
          addressLine2: dto.addressLine2 ?? null,
          landmark: dto.landmark ?? null,
          ...(dto.cityId ? { cityId: dto.cityId } : {}),
          cityLabel: dto.cityLabel ?? null,
          pincode: dto.pincode ?? null,
          geoLatitude: dto.geoLatitude ?? null,
          geoLongitude: dto.geoLongitude ?? null,
          priority: dto.priority ?? 'NORMAL',
          tags: dto.tags ?? [],
          externalRef: dto.externalRef ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
        tx,
      );

      await this.activity.recordLeadActivity(
        row.id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.CREATED,
          actorUserId: actor.userId,
          toStatus: row.status,
          message: `Lead created from ${row.source}`,
          metadata: { code: row.code },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.LeadCreated, {
      leadId: lead.id as LeadId,
      source: lead.source,
    });

    return lead;
  }

  /**
   * Create a lead from the public website / Google Ads / WhatsApp landing
   * page. Unauthenticated — the caller supplies a tenant id (resolved
   * from a slug or attribution rule) rather than an `AuthPrincipal`.
   *
   * Honeypot and rate-limiting are enforced at the controller layer.
   * Here we keep the business logic identical to the authenticated
   * path so timelines / events / dedupe all behave the same.
   */
  async publicCreate(
    tenantId: string,
    dto: CreateLeadDto,
    meta: { ip?: string | null; userAgent?: string | null; referer?: string | null } = {},
  ) {
    if (dto.externalRef) {
      const existing = await this.repo.findByExternalRef(tenantId, dto.externalRef);
      if (existing) return existing;
    }

    const dupe = await this.repo.findRecentDuplicate(tenantId, dto.phone);
    if (dupe) {
      this.logger.debug({ leadId: dupe.id, phone: dto.phone }, 'Duplicate public lead suppressed');
      // For the public path we surface the duplicate softly — the
      // visitor should still see "we got your request". Returning the
      // existing row preserves idempotency.
      return dupe;
    }

    const code = await this.repo.nextCode(tenantId);
    const tags = Array.from(new Set([...(dto.tags ?? []), 'public:web']));

    const lead = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.create(
        {
          code,
          tenantId,
          customerName: dto.customerName,
          phone: dto.phone,
          whatsappNumber: dto.whatsappNumber ?? null,
          email: dto.email ?? null,
          source: dto.source,
          applianceType: dto.applianceType ?? null,
          applianceBrand: dto.applianceBrand ?? null,
          issueDescription: dto.issueDescription ?? null,
          addressLine1: dto.addressLine1 ?? null,
          addressLine2: dto.addressLine2 ?? null,
          landmark: dto.landmark ?? null,
          ...(dto.cityId ? { cityId: dto.cityId } : {}),
          cityLabel: dto.cityLabel ?? null,
          pincode: dto.pincode ?? null,
          geoLatitude: dto.geoLatitude ?? null,
          geoLongitude: dto.geoLongitude ?? null,
          priority: dto.priority ?? 'NORMAL',
          tags,
          externalRef: dto.externalRef ?? null,
        },
        tx,
      );
      await this.activity.recordLeadActivity(
        row.id,
        {
          tenantId,
          type: ActivityType.CREATED,
          message: `Lead created from public ${row.source}`,
          metadata: {
            code: row.code,
            ip: meta.ip ?? null,
            userAgent: meta.userAgent ?? null,
            referer: meta.referer ?? null,
          },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.LeadCreated, {
      leadId: lead.id as LeadId,
      source: lead.source,
    });

    return lead;
  }

  list(actor: AuthPrincipal, query: ListLeadsDto) {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: AuthPrincipal, id: string) {
    const lead = await this.repo.findById(actor.tenantId, id);
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateLeadDto) {
    const lead = await this.getById(actor, id);
    if (TERMINAL_LEAD_STATUSES.has(lead.status as LeadStatus)) {
      throw new ForbiddenException('Lead is closed and cannot be edited');
    }

    // Build a diff for the timeline so ops can see exactly what changed.
    const changed = diff(lead as Record<string, unknown>, dto as Record<string, unknown>);
    if (Object.keys(changed).length === 0) return lead;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          ...dto,
          ...(dto.cityId === undefined ? {} : { city: dto.cityId ? { connect: { id: dto.cityId } } : { disconnect: true } }),
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordLeadActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.FIELD_UPDATED,
          actorUserId: actor.userId,
          message: `Updated ${Object.keys(changed).join(', ')}`,
          metadata: { changed },
        },
        tx,
      );
      return row;
    });

    return updated;
  }

  async assign(actor: AuthPrincipal, id: string, dto: AssignLeadDto) {
    const lead = await this.getById(actor, id);
    if (lead.assignedUserId === dto.assigneeUserId) return lead;

    // Verify assignee exists in same tenant.
    const assignee = await this.prisma.client.user.findFirst({
      where: { id: dto.assigneeUserId, tenantId: actor.tenantId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!assignee) throw new BadRequestException('Assignee not found or inactive');

    const previousAssignee = lead.assignedUserId;
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          assignedUser: { connect: { id: dto.assigneeUserId } },
          assignedAt: new Date(),
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordLeadActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: previousAssignee ? ActivityType.REASSIGNED : ActivityType.ASSIGNED,
          actorUserId: actor.userId,
          message: `Assigned to ${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim(),
          metadata: { from: previousAssignee, to: dto.assigneeUserId },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.LeadAssigned, {
      leadId: id as LeadId,
      assignedUserId: dto.assigneeUserId as never,
    });

    return updated;
  }

  async changeStatus(actor: AuthPrincipal, id: string, dto: ChangeLeadStatusDto) {
    const lead = await this.getById(actor, id);
    if (!canTransitionLead(lead.status as LeadStatus, dto.status)) {
      throw new ForbiddenException(
        `Cannot transition lead from ${lead.status} to ${dto.status}`,
      );
    }

    const now = new Date();
    const stateTimestamps: Record<string, Date> = {};
    if (dto.status === 'CONTACTED') stateTimestamps['contactedAt'] = now;
    if (dto.status === 'QUALIFIED') stateTimestamps['qualifiedAt'] = now;
    if (TERMINAL_LEAD_STATUSES.has(dto.status)) stateTimestamps['closedAt'] = now;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        { status: dto.status, ...stateTimestamps, updatedBy: actor.userId },
        tx,
      );
      await this.activity.recordLeadActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.STATUS_CHANGED,
          actorUserId: actor.userId,
          fromStatus: lead.status,
          toStatus: dto.status,
          message: dto.reason ?? null,
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.LeadStatusChanged, {
      leadId: id as LeadId,
      from: lead.status as LeadStatus,
      to: dto.status,
    });

    return updated;
  }

  async addNote(actor: AuthPrincipal, id: string, dto: AddLeadNoteDto) {
    await this.getById(actor, id);
    const note = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.addNote({
        leadId: id,
        tenantId: actor.tenantId,
        authorUserId: actor.userId,
        body: dto.body,
      });
      await this.activity.recordLeadActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.NOTE_ADDED,
          actorUserId: actor.userId,
          message: dto.body.slice(0, 140),
          metadata: { noteId: row.id },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.LeadNoteAdded, {
      leadId: id as LeadId,
      noteId: note.id,
    });

    return note;
  }

  listNotes(_actor: AuthPrincipal, id: string) {
    return this.repo.listNotes(id);
  }

  listActivities(_actor: AuthPrincipal, id: string) {
    return this.activity.listLeadActivities(id);
  }
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) {
      out[key] = { from: before[key] ?? null, to: value };
    }
  }
  return out;
}
