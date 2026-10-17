import type { AuthPrincipal } from '@ac/auth';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

/** Strips markdown to plain text for FAQ answers rendered natively in the app. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/^\s*[-+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Device sessions + public FAQ helpers for the customer app. */
@Injectable()
export class MeAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Revoke a device: `deviceId` may be a Session id or the device fingerprint
   * id. Revokes the matching sessions (refresh tokens stop working) and
   * deactivates the push tokens registered from that device.
   */
  async revokeDevice(actor: AuthPrincipal, deviceId: string): Promise<{ ok: true }> {
    const now = new Date();
    const sessions = await this.prisma.client.session.updateMany({
      where: { userId: actor.userId, revokedAt: null, OR: [{ id: deviceId }, { deviceId }] },
      data: { revokedAt: now },
    });
    const pushes = await this.prisma.client.pushDevice.updateMany({
      where: { userId: actor.userId, tenantId: actor.tenantId, isActive: true, OR: [{ id: deviceId }, { deviceId }] },
      data: { isActive: false },
    });
    if (sessions.count === 0 && pushes.count === 0) throw new NotFoundException('Device not found');
    return { ok: true };
  }

  async resolvePublicTenant(slug?: string | null): Promise<string | null> {
    if (slug) {
      const t = await this.prisma.client.tenant.findFirst({
        where: { slug, isActive: true, deletedAt: null },
        select: { id: true },
      });
      return t?.id ?? null;
    }
    const envId = process.env.WEB_TENANT_ID?.trim();
    if (envId) return envId;
    const first = await this.prisma.client.tenant.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return first?.id ?? null;
  }

  /** Published, public KB articles as `{ q, a }` pairs (most helpful first). */
  async faqs(tenantSlug?: string | null): Promise<{ q: string; a: string; slug: string }[]> {
    const tenantId = await this.resolvePublicTenant(tenantSlug);
    if (!tenantId) return [];
    const rows = await this.prisma.client.knowledgeBaseArticle.findMany({
      where: { tenantId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null },
      orderBy: [{ helpfulCount: 'desc' }, { publishedAt: 'desc' }],
      take: 50,
      select: { slug: true, title: true, excerpt: true, bodyMarkdown: true },
    });
    return rows.map((r) => ({
      q: r.title,
      a: markdownToPlain(r.bodyMarkdown || r.excerpt || ''),
      slug: r.slug,
    }));
  }
}
