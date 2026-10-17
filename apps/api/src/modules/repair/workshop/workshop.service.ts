import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { RepairEventName } from '../domain/events';
import {
  allowedWorkshopTransitions,
  appendWorkshopHistory,
  canTransitionWorkshop,
  type ServiceModeValue,
  workshopTimestampField,
} from '../domain/workshop-state';
import { RepairEventsService } from '../repair-events.service';
import { CreateWorkshopJobDto, ListWorkshopJobsDto, TransitionWorkshopJobDto } from './dto/workshop.dto';
import { createWorkshopJobTx } from './workshop-job.factory';

const JOB_INCLUDE = {
  booking: {
    select: {
      id: true,
      code: true,
      status: true,
      category: true,
      serviceMode: true,
      scheduledAt: true,
      technicianId: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      appliance: {
        select: { id: true, category: true, brand: true, modelNumber: true, serialNumber: true },
      },
    },
  },
} satisfies Prisma.WorkshopJobInclude;

type JobWithBooking = Prisma.WorkshopJobGetPayload<{ include: typeof JOB_INCLUDE }>;

@Injectable()
export class WorkshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RepairEventsService,
  ) {}

  async list(actor: AuthPrincipal, query: ListWorkshopJobsDto) {
    const where: Prisma.WorkshopJobWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { booking: { code: { contains: query.search, mode: 'insensitive' } } },
              {
                booking: {
                  customer: { fullName: { contains: query.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.workshopJob.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.workshopJob.count({ where }),
    ]);
    return { items: rows.map((r) => this.decorate(r)), total };
  }

  async get(actor: AuthPrincipal, id: string) {
    const job = await this.prisma.client.workshopJob.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: JOB_INCLUDE,
    });
    if (!job) throw new NotFoundException('Workshop job not found');
    return this.decorate(job);
  }

  async create(actor: AuthPrincipal, dto: CreateWorkshopJobDto) {
    const booking = await this.prisma.client.booking.findFirst({
      where: { id: dto.bookingId, tenantId: actor.tenantId },
      select: { id: true, status: true, serviceMode: true, workshopJob: { select: { id: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.workshopJob) {
      throw new ConflictException({
        message: 'Booking already has a workshop job',
        code: 'WORKSHOP_JOB_EXISTS',
        workshopJobId: booking.workshopJob.id,
      });
    }
    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new ForbiddenException(`Booking is ${booking.status}`);
    }
    if (dto.warehouseId) {
      const wh = await this.prisma.client.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!wh) throw new BadRequestException('Warehouse not found');
    }

    // An on-site booking moved to the workshop becomes a pickup/drop job.
    const mode: ServiceModeValue =
      booking.serviceMode === 'ON_SITE' ? 'PICKUP_DROP' : booking.serviceMode;

    const job = await this.prisma.client.$transaction(async (tx) => {
      if (booking.serviceMode !== mode) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { serviceMode: mode, updatedBy: actor.userId },
        });
      }
      return createWorkshopJobTx(tx, {
        tenantId: actor.tenantId,
        bookingId: booking.id,
        serviceMode: mode,
        actorUserId: actor.userId,
        warehouseId: dto.warehouseId ?? null,
        pickupScheduledAt: dto.pickupScheduledAt ? new Date(dto.pickupScheduledAt) : null,
        estimatedReadyAt: dto.estimatedReadyAt ? new Date(dto.estimatedReadyAt) : null,
        notes: dto.notes ?? null,
      });
    });

    this.events.publish(RepairEventName.WorkshopJobCreated, {
      tenantId: actor.tenantId,
      workshopJobId: job.id,
      bookingId: booking.id,
      number: job.number,
      status: job.status,
    });
    return this.get(actor, job.id);
  }

  async transition(actor: AuthPrincipal, id: string, dto: TransitionWorkshopJobDto) {
    const job = await this.get(actor, id);
    const from = job.status;
    const mode = job.booking.serviceMode;
    if (!canTransitionWorkshop(from, dto.status, mode)) {
      throw new ConflictException({
        message: `Cannot move workshop job from ${from} to ${dto.status}`,
        code: 'WORKSHOP_INVALID_TRANSITION',
        allowed: allowedWorkshopTransitions(from, mode),
      });
    }

    const now = new Date();
    const stamp = workshopTimestampField(dto.status);
    const history = appendWorkshopHistory(job.history, {
      status: dto.status,
      from,
      at: now.toISOString(),
      by: actor.userId,
      note: dto.note?.trim() || null,
    });

    await this.prisma.client.workshopJob.update({
      where: { id },
      data: {
        status: dto.status,
        ...(stamp ? { [stamp]: now } : {}),
        ...(dto.conditionOnReceipt !== undefined
          ? { conditionOnReceipt: dto.conditionOnReceipt.trim() || null }
          : {}),
        ...(dto.accessoriesReceived ? { accessoriesReceived: dto.accessoriesReceived } : {}),
        ...(dto.photos?.length ? { photos: [...job.photos, ...dto.photos] } : {}),
        ...(dto.estimatedReadyAt ? { estimatedReadyAt: new Date(dto.estimatedReadyAt) } : {}),
        history: history as unknown as Prisma.InputJsonValue,
        updatedBy: actor.userId,
      },
    });

    this.events.publish(RepairEventName.WorkshopStatusChanged, {
      tenantId: actor.tenantId,
      workshopJobId: id,
      bookingId: job.bookingId,
      number: job.number,
      from,
      to: dto.status,
    });
    return this.get(actor, id);
  }

  private decorate(job: JobWithBooking) {
    return {
      ...job,
      allowedTransitions: allowedWorkshopTransitions(
        job.status,
        job.booking.serviceMode,
      ),
    };
  }
}
