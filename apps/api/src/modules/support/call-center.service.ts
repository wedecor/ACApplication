import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  CallDirection,
  CallStatus,
  DomainEventName,
  MISSED_CALL_STATUSES,
  type CustomerId,
  type UserId,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nextSupportNumber } from '../../common/support/numbering';
import { normaliseE164 } from '../../common/support/channels';
import type {
  AddRecordingDto,
  CallDispositionDto,
  ClickToCallDto,
  ListCallsDto,
  StartCallDto,
  UpdateCallStatusDto,
} from './dto/call.dto';

@Injectable()
export class CallCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {}

  // -------------------------------------------------------- public lifecycle

  /**
   * Inbound calls — invoked from the Exotel/Twilio/Knowlarity webhook
   * adapters. Returns the call log id so the IVR can attach further
   * events (answered, completed) to the same row.
   */
  async startCall(
    tenantId: string,
    dto: StartCallDto,
  ): Promise<{ id: string; number: string; isNew: boolean }> {
    // Idempotency on (tenant, provider, externalCallId).
    if (dto.externalCallId && dto.provider) {
      const dup = await this.prisma.client.callLog.findFirst({
        where: {
          tenantId,
          provider: dto.provider,
          externalCallId: dto.externalCallId,
        },
        select: { id: true, number: true },
      });
      if (dup) return { ...dup, isNew: false };
    }

    const customer = await this.resolveCustomer(
      tenantId,
      dto.customerId ?? null,
      dto.fromNumber,
      dto.toNumber,
      dto.direction,
    );

    const number = await nextSupportNumber(this.prisma, tenantId, {
      prefix: 'CALL',
      table: 'callLog',
    });

    const call = await this.prisma.client.callLog.create({
      data: {
        tenantId,
        number,
        direction: dto.direction,
        status: CallStatus.RINGING,
        customerId: customer?.id ?? null,
        fromNumber: normaliseE164(dto.fromNumber),
        toNumber: normaliseE164(dto.toNumber),
        agentUserId: dto.agentUserId,
        ticketId: dto.ticketId,
        bookingId: dto.bookingId,
        provider: dto.provider ?? 'manual',
        externalCallId: dto.externalCallId,
        queue: dto.queue,
        startedAt: new Date(),
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true, number: true },
    });

    this.events.publish(DomainEventName.CallIncoming, {
      callLogId: call.id,
      direction: dto.direction,
      fromNumber: dto.fromNumber,
      toNumber: dto.toNumber,
      customerId: (customer?.id ?? null) as CustomerId | null,
      provider: dto.provider ?? 'manual',
      queue: dto.queue ?? null,
    });

    return { ...call, isNew: true };
  }

  async updateStatus(
    tenantId: string,
    callLogId: string,
    dto: UpdateCallStatusDto,
  ): Promise<void> {
    const call = await this.requireCall(tenantId, callLogId);
    const now = new Date();
    const data: Prisma.CallLogUpdateInput = {
      status: dto.status,
      ...(dto.agentUserId ? { agent: { connect: { id: dto.agentUserId } } } : {}),
      ...(dto.metadata ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
    };
    if (dto.status === CallStatus.IN_PROGRESS && !call.answeredAt) data.answeredAt = now;
    const terminalStatuses: ReadonlyArray<CallStatus> = [
      CallStatus.COMPLETED,
      CallStatus.MISSED,
      CallStatus.NO_ANSWER,
      CallStatus.BUSY,
      CallStatus.FAILED,
      CallStatus.ABANDONED,
      CallStatus.VOICEMAIL,
    ];
    if (terminalStatuses.includes(dto.status)) {
      data.endedAt = now;
      if (dto.durationS != null) data.durationS = dto.durationS;
      else if (call.answeredAt)
        data.durationS = Math.max(0, Math.round((now.getTime() - call.answeredAt.getTime()) / 1000));
    }
    await this.prisma.client.callLog.update({ where: { id: callLogId }, data });

    if (dto.status === CallStatus.IN_PROGRESS && !call.answeredAt && dto.agentUserId) {
      this.events.publish(DomainEventName.CallAnswered, {
        callLogId,
        agentUserId: dto.agentUserId as UserId,
        answeredAt: now.toISOString(),
      });
    }
    if (dto.status === CallStatus.COMPLETED || MISSED_CALL_STATUSES.has(dto.status)) {
      this.events.publish(DomainEventName.CallCompleted, {
        callLogId,
        status: dto.status,
        durationS: data.durationS as number | null | undefined ?? null,
        agentUserId: (call.agentUserId ?? dto.agentUserId ?? null) as UserId | null,
      });
      if (MISSED_CALL_STATUSES.has(dto.status)) {
        this.events.publish(DomainEventName.CallMissed, {
          callLogId,
          fromNumber: call.fromNumber,
          customerId: (call.customerId ?? null) as CustomerId | null,
          queue: call.queue ?? null,
        });
      }
    }
  }

  async setDisposition(
    actor: AuthPrincipal,
    callLogId: string,
    dto: CallDispositionDto,
  ): Promise<void> {
    await this.requireCall(actor.tenantId, callLogId);
    await this.prisma.client.callLog.update({
      where: { id: callLogId },
      data: {
        disposition: dto.disposition,
        dispositionNotes: dto.notes,
        followupTicketId: dto.followupTicketId,
        updatedBy: actor.userId,
      },
    });
    this.events.publish(DomainEventName.CallDispositionSet, {
      callLogId,
      disposition: dto.disposition,
      notes: dto.notes ?? null,
    });
  }

  /**
   * Click-to-call — places an outbound call request to the provider. We
   * persist the row as `QUEUED` and emit `CallIncoming` so the agent's
   * UI shows a "calling..." pill while the provider's webhook drives the
   * subsequent state machine.
   */
  async clickToCall(
    actor: AuthPrincipal,
    dto: ClickToCallDto,
  ): Promise<{ id: string; number: string }> {
    const fromNumber = process.env.CALL_CENTER_FROM_NUMBER ?? 'agent';
    const result = await this.startCall(actor.tenantId, {
      direction: CallDirection.OUTBOUND,
      fromNumber,
      toNumber: dto.toNumber,
      customerId: dto.customerId,
      agentUserId: actor.userId,
      ticketId: dto.ticketId,
      provider: dto.provider ?? process.env.CALL_CENTER_PROVIDER ?? 'manual',
    });
    return { id: result.id, number: result.number };
  }

  async addRecording(
    tenantId: string,
    callLogId: string,
    dto: AddRecordingDto,
  ): Promise<{ id: string }> {
    const call = await this.requireCall(tenantId, callLogId);
    const recording = await this.prisma.client.callRecording.create({
      data: {
        tenantId,
        callLogId,
        storageKey: dto.storageKey,
        url: dto.url,
        durationS: dto.durationS,
        sizeBytes: dto.sizeBytes,
        language: dto.language,
      },
      select: { id: true },
    });
    await this.prisma.client.callLog.update({
      where: { id: callLogId },
      data: { recordingUrl: dto.url },
    });
    this.events.publish(DomainEventName.CallRecordingReady, {
      callLogId,
      recordingId: recording.id,
      url: dto.url,
      durationS: dto.durationS ?? null,
    });
    void call;
    return recording;
  }

  // ---------------------------------------------------------------- read

  async list(actor: AuthPrincipal, dto: ListCallsDto): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const where: Prisma.CallLogWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.direction) where.direction = dto.direction;
    if (dto.status?.length) where.status = { in: dto.status };
    if (dto.agentUserId) where.agentUserId = dto.agentUserId;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.ticketId) where.ticketId = dto.ticketId;
    if (dto.disposition?.length) where.disposition = { in: dto.disposition };
    if (dto.missed === 'true') {
      where.status = { in: Array.from(MISSED_CALL_STATUSES) };
    }
    if (dto.search) {
      where.OR = [
        { number: { contains: dto.search, mode: 'insensitive' } },
        { fromNumber: { contains: dto.search, mode: 'insensitive' } },
        { toNumber: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.callLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          agent: { select: { id: true, firstName: true, lastName: true } },
          ticket: { select: { id: true, number: true, status: true } },
        },
      }),
      this.prisma.client.callLog.count({ where }),
    ]);
    return { items, page: dto.page, pageSize: dto.pageSize, total };
  }

  async get(actor: AuthPrincipal, id: string): Promise<unknown> {
    const call = await this.prisma.client.callLog.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        customer: true,
        agent: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        ticket: { select: { id: true, number: true, status: true, priority: true } },
        recordings: true,
        booking: { select: { id: true, code: true, status: true } },
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async listMissedQueue(actor: AuthPrincipal): Promise<unknown[]> {
    return this.prisma.client.callLog.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        status: { in: Array.from(MISSED_CALL_STATUSES) },
        disposition: null,
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  // ------------------------------------------------------------- internals

  private async requireCall(
    tenantId: string,
    id: string,
  ): Promise<{
    id: string;
    answeredAt: Date | null;
    agentUserId: string | null;
    fromNumber: string;
    customerId: string | null;
    queue: string | null;
  }> {
    const call = await this.prisma.client.callLog.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        answeredAt: true,
        agentUserId: true,
        fromNumber: true,
        customerId: true,
        queue: true,
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private async resolveCustomer(
    tenantId: string,
    explicitId: string | null,
    fromNumber: string,
    toNumber: string,
    direction: CallDirection,
  ): Promise<{ id: string } | null> {
    if (explicitId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: explicitId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (customer) return customer;
    }
    const lookup = direction === CallDirection.INBOUND ? fromNumber : toNumber;
    const normalised = normaliseE164(lookup);
    return this.prisma.client.customer.findFirst({
      where: { tenantId, phone: normalised, deletedAt: null },
      select: { id: true },
    });
  }
}
