import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateMeDto } from './dto/update-me.dto';
import { UsersRepository } from './users.repository';

/** "Asha  K Rao" → { firstName: "Asha", lastName: "K Rao" } */
export function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.length > 1 ? parts.slice(1).join(' ') : null };
}

export interface DeviceView {
  id: string;
  deviceId: string;
  modelName: string | null;
  platform: string | null;
  lastSeenAt: string;
  current: boolean;
}

/**
 * Active sessions merged with push-device metadata (model name, platform).
 * `id` is the Session id — what `DELETE /me/devices/:id` revokes.
 */
export function buildDeviceList(
  sessions: { id: string; deviceId: string | null; device: string; lastUsedAt: Date }[],
  pushDevices: { deviceId: string | null; modelName: string | null; platform: string | null; lastSeenAt: Date }[],
  currentSessionId: string | null,
): DeviceView[] {
  const byDevice = new Map(pushDevices.filter((p) => p.deviceId).map((p) => [p.deviceId!, p]));
  return sessions
    .map((s) => {
      const push = s.deviceId ? byDevice.get(s.deviceId) : undefined;
      const last = push && push.lastSeenAt > s.lastUsedAt ? push.lastSeenAt : s.lastUsedAt;
      return {
        id: s.id,
        deviceId: s.deviceId ?? s.id,
        modelName: push?.modelName ?? null,
        platform: push?.platform ?? s.device,
        lastSeenAt: last.toISOString(),
        current: s.id === currentSessionId,
      };
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  getById(id: string) {
    return this.repo.findById(id);
  }

  /** Profile fields the apps render (name from Customer when present). */
  async profile(userId: string, tenantId: string, currentSessionId: string | null) {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const [customer, devices] = await Promise.all([
      this.prisma.client.customer.findFirst({
        where: { userId, tenantId },
        select: { id: true, fullName: true, email: true },
      }),
      this.devices(userId, currentSessionId),
    ]);
    const { passwordHash: _ph, ...safe } = user;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return {
      ...safe,
      fullName: customer?.fullName ?? (name || undefined),
      email: user.email ?? customer?.email ?? undefined,
      customerId: customer?.id,
      devices,
    };
  }

  async devices(userId: string, currentSessionId: string | null): Promise<DeviceView[]> {
    const now = new Date();
    const [sessions, pushDevices] = await Promise.all([
      this.prisma.client.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { lastUsedAt: 'desc' },
        take: 50,
        select: { id: true, deviceId: true, device: true, lastUsedAt: true },
      }),
      this.prisma.client.pushDevice.findMany({
        where: { userId, isActive: true },
        select: { deviceId: true, modelName: true, platform: true, lastSeenAt: true },
      }),
    ]);
    return buildDeviceList(sessions, pushDevices, currentSessionId);
  }

  /** Updates name / email / avatar and keeps Customer.fullName / email in sync. */
  async updateMe(userId: string, tenantId: string, dto: UpdateMeDto): Promise<{ ok: true }> {
    const email = dto.email?.trim().toLowerCase();
    if (email) {
      const taken = await this.prisma.client.user.findFirst({
        where: { email, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('That email is already in use');
    }
    const name = dto.fullName ? splitFullName(dto.fullName) : null;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(name ? { firstName: name.firstName, lastName: name.lastName } : {}),
          ...(email ? { email, emailVerified: false } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
          updatedBy: userId,
        },
      });
      if (name || email) {
        await tx.customer.updateMany({
          where: { userId, tenantId },
          data: {
            ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
            ...(email ? { email } : {}),
          },
        });
      }
    });
    return { ok: true };
  }
}
