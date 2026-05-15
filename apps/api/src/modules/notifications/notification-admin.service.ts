import { ForbiddenException, Injectable } from '@nestjs/common';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';
import { hasPermission } from '@ac/auth';

import { NotificationMetricsService } from './notification-metrics.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationRateLimiterService } from './notification-rate-limiter.service';
import { NotificationRepository } from './notification.repository';
import { ProviderHealthService } from './provider-health.service';

@Injectable()
export class NotificationAdminService {
  constructor(
    private readonly queue: NotificationQueueService,
    private readonly health: ProviderHealthService,
    private readonly rateLimiter: NotificationRateLimiterService,
    private readonly metrics: NotificationMetricsService,
    private readonly repo: NotificationRepository,
  ) {}

  async getOpsDashboard(actor: AuthPrincipal) {
    const [queue, providers, killSwitch] = await Promise.all([
      this.queue.getStats(),
      this.health.listProviderHealth(),
      this.rateLimiter.isKillSwitchActive(actor.tenantId),
    ]);
    return { queue, providers, killSwitch, tenantId: actor.tenantId };
  }

  pauseQueue(actor: AuthPrincipal) {
    this.assertPlatformOps(actor);
    return this.queue.pause();
  }

  resumeQueue(actor: AuthPrincipal) {
    this.assertPlatformOps(actor);
    return this.queue.resume();
  }

  async listDlq(actor: AuthPrincipal, limit?: number) {
    const jobs = await this.queue.listDlqJobs(limit);
    const filtered = [];
    for (const job of jobs) {
      const row = await this.repo.findById(job.data.notificationId);
      if (row?.tenantId === actor.tenantId) {
        filtered.push(job);
      }
    }
    return filtered;
  }

  async retryDlq(actor: AuthPrincipal, jobId: string) {
    const jobs = await this.queue.listDlqJobs(500);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      throw new ForbiddenException('DLQ job not found');
    }
    const row = await this.repo.findById(job.data.notificationId);
    if (!row || row.tenantId !== actor.tenantId) {
      throw new ForbiddenException('DLQ job not accessible');
    }
    return this.queue.retryDlqJob(jobId);
  }

  setKillSwitch(actor: AuthPrincipal, enabled: boolean) {
    return this.rateLimiter.setKillSwitch(actor.tenantId, enabled);
  }

  getMetrics() {
    return this.metrics.expose();
  }

  private assertPlatformOps(actor: AuthPrincipal): void {
    if (!hasPermission(Permission.ALL, { permissions: actor.permissions, roles: actor.roles })) {
      throw new ForbiddenException('Platform queue controls require super-admin access');
    }
  }
}
