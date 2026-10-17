import type { AuthPrincipal } from '@ac/auth';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { isFieldTechnician } from './domain/access';

/**
 * Row-level scoping for field technicians: they may only see / write repair
 * records attached to bookings assigned to them. Staff are unrestricted
 * (route-level permissions still apply).
 */
@Injectable()
export class RepairAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Technician id for a field technician, `null` for staff. Throws when a technician has no profile. */
  async scopedTechnicianId(actor: AuthPrincipal): Promise<string | null> {
    if (!isFieldTechnician(actor)) return null;
    const tech = await this.prisma.client.technician.findFirst({
      where: { userId: actor.userId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!tech) throw new ForbiddenException('No technician profile linked to this user');
    return tech.id;
  }

  /** Throws unless the actor is staff or the technician assigned to the booking. */
  async assertBookingAccess(
    actor: AuthPrincipal,
    booking: { technicianId: string | null },
  ): Promise<void> {
    const techId = await this.scopedTechnicianId(actor);
    if (techId && booking.technicianId !== techId) {
      throw new ForbiddenException('This booking is not assigned to you');
    }
  }
}
