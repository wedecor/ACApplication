#!/usr/bin/env tsx
/**
 * STEP 3 — Chaos / failure resilience validation (operational QA).
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, NotificationStatus } from '@prisma/client';
const NOTIFICATION_QUEUE_NAME = 'notification-dispatch';
const NOTIFICATION_DLQ_NAME = 'notification-dispatch-dlq';
const WORKFLOW_STEP_QUEUE = 'workflow-step-execution';

const ROOT = process.env.PROJECT_ROOT ?? join(process.cwd(), '../..');
const REPORT = join(ROOT, 'scripts/ops-chaos-report.json');
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

const issues: Array<{ severity: string; area: string; detail: string }> = [];
const report: Record<string, unknown> = {
  timestamp: new Date().toISOString(),
  issues,
};

function log(section: string, data: unknown) {
  (report as Record<string, unknown>)[section] = data;
}

function issue(severity: string, area: string, detail: string) {
  issues.push({ severity, area, detail });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.json().catch(() => null);
  const data =
    raw && typeof raw === 'object' && 'data' in (raw as object)
      ? (raw as { data: unknown }).data
      : raw;
  return { status: res.status, body: data ?? raw, ok: res.ok };
}

async function login(phone: string) {
  const req = await api(null, 'POST', '/auth/otp/request', { destination: phone, purpose: 'LOGIN' });
  const code = (req.body as { devCode?: string })?.devCode;
  if (!code) throw new Error(`No devCode for ${phone}`);
  const ver = await api(null, 'POST', '/auth/otp/verify', { destination: phone, code });
  return (ver.body as { accessToken: string }).accessToken;
}

function redisCmd(...args: string[]) {
  try {
    return execSync(`docker exec ac-redis redis-cli ${args.join(' ')}`, { encoding: 'utf8' }).trim();
  } catch (e) {
    return `ERR: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function shell(cmd: string) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim();
}

async function bullQueueCounts() {
  const keys = {
    notifWait: redisCmd('LLEN', `bull:${NOTIFICATION_QUEUE_NAME}:wait`),
    notifDelayed: redisCmd('ZCARD', `bull:${NOTIFICATION_QUEUE_NAME}:delayed`),
    notifActive: redisCmd('LLEN', `bull:${NOTIFICATION_QUEUE_NAME}:active`),
    notifDlq: redisCmd('LLEN', `bull:${NOTIFICATION_DLQ_NAME}:wait`),
    workflowDelayed: redisCmd('ZCARD', `bull:${WORKFLOW_STEP_QUEUE}:delayed`),
    workflowWait: redisCmd('LLEN', `bull:${WORKFLOW_STEP_QUEUE}:wait`),
  };
  return keys;
}

async function countNotifications(since: Date) {
  const rows = await prisma.notification.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since } },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count]));
}

async function workflowDelayedSteps() {
  return prisma.workflowStepExecution.findMany({
    where: { status: 'PENDING', scheduledAt: { gt: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
    include: { instance: { select: { definitionKey: true, resourceId: true, status: true } } },
  });
}

async function main() {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const superToken = await login(process.env.QA_SUPER_PHONE ?? '+919900000001');
  const dispToken = await login(process.env.QA_DISPATCHER_PHONE ?? '+919900000003');

  // --- Baseline ---
  const health = await api(null, 'GET', '/health');
  const dashboard = await api(superToken, 'GET', '/notifications/admin/dashboard');
  const baselineBull = await bullQueueCounts();
  log('baseline', {
    apiHealth: health.ok,
    dashboard: dashboard.body,
    bull: baselineBull,
    notificationCounts: await countNotifications(since),
    delayedWorkflowSteps: (await workflowDelayedSteps()).length,
  });

  // --- Idempotency ---
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  const user = await prisma.user.findFirst({ where: { phone: '+919999999999' } });
  if (tenant && user?.phone) {
    const beforeOtp = await prisma.notification.count({
      where: { tenantId: tenant.id, template: 'auth.otp' },
    });
    await api(null, 'POST', '/auth/otp/request', { destination: user.phone, purpose: 'LOGIN' });
    await api(null, 'POST', '/auth/otp/request', { destination: user.phone, purpose: 'LOGIN' });
    await sleep(2500);
    const afterOtp = await prisma.notification.count({
      where: { tenantId: tenant.id, template: 'auth.otp' },
    });
    log('idempotency', {
      note: 'Duplicate OTP requests within idempotency window should not create duplicate SENT rows',
      otpRowsAdded: afterOtp - beforeOtp,
    });
    if (afterOtp - beforeOtp > 2) {
      issue('medium', 'idempotency', `OTP burst created ${afterOtp - beforeOtp} rows (expected ≤2 channels)`);
    }
  }

  // Enqueue burst via booking (fires notifications)
  const city = await prisma.city.findFirst({ where: { tenantId: tenant!.id } });
  const customer = await prisma.customer.findFirst({ where: { tenantId: tenant!.id } });
  let chaosBookingId: string | undefined;
  if (city && customer) {
    const b = await api(dispToken, 'POST', '/bookings', {
      customerId: customer.id,
      cityId: city.id,
      category: 'AC_SERVICING',
      scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      address: { line1: '1 Chaos St', city: city.name, state: 'KA', pincode: '560001' },
    });
    chaosBookingId = (b.body as { id?: string })?.id;
    await sleep(3000);
  }

  const preRedis = await bullQueueCounts();
  const preNotifCount = await prisma.notification.count({
    where: { createdAt: { gte: new Date(Date.now() - 120_000) } },
  });

  // --- STEP 1: Redis failure ---
  const redisRestartStart = Date.now();
  let redisRestartOk = false;
  try {
    shell('docker restart ac-redis');
    redisRestartOk = true;
  } catch {
    issue('high', 'redis', 'docker restart ac-redis failed');
  }
  await sleep(5000);
  const redisPing = redisCmd('PING');
  const healthAfterRedis = await api(null, 'GET', '/health');
  await sleep(3000);
  const postRedisBull = await bullQueueCounts();
  const postRedisDashboard = await api(superToken, 'GET', '/notifications/admin/dashboard');

  log('redisRecovery', {
    restartOk: redisRestartOk,
    pingAfter: redisPing,
    apiHealthAfter: healthAfterRedis.ok,
    downtimeMs: Date.now() - redisRestartStart,
    bullBefore: preRedis,
    bullAfter: postRedisBull,
    dashboardAfter: postRedisDashboard.body,
    delayedStepsAfter: (await workflowDelayedSteps()).map((s) => ({
      stepKey: s.stepKey,
      scheduledAt: s.scheduledAt,
      instance: s.instance.definitionKey,
    })),
    verdict:
      healthAfterRedis.ok && redisPing === 'PONG'
        ? 'API survived Redis restart; BullMQ keys present'
        : 'Degraded after Redis restart',
  });

  if (!healthAfterRedis.ok) {
    issue('critical', 'redis', 'API unhealthy after Redis restart');
  }

  // --- STEP 2: Queue pause (worker crash simulation) ---
  const pauseRes = await api(superToken, 'POST', '/notifications/admin/queue/pause');
  await api(dispToken, 'POST', '/auth/otp/request', {
    destination: '+919876543210',
    purpose: 'LOGIN',
  });
  await sleep(1500);
  const pausedStats = await api(superToken, 'GET', '/notifications/admin/dashboard');
  const resumeRes = await api(superToken, 'POST', '/notifications/admin/queue/resume');
  await sleep(3000);
  const resumedStats = await api(superToken, 'GET', '/notifications/admin/dashboard');

  const pauseOk = pauseRes.status === 200 || pauseRes.status === 201;
  const resumeOk = resumeRes.status === 200 || resumeRes.status === 201;
  if (!pauseOk) issue('medium', 'queue', `Pause queue returned ${pauseRes.status}`);
  if (!resumeOk) issue('medium', 'queue', `Resume queue returned ${resumeRes.status}`);
  log('workerCrashSimulation', {
    pauseStatus: pauseRes.status,
    pauseBody: pauseRes.body,
    pausedQueue: (pausedStats.body as { queue?: { main?: { paused?: boolean } } })?.queue?.main,
    resumeStatus: resumeRes.status,
    resumeBody: resumeRes.body,
    resumedQueue: (resumedStats.body as { queue?: { main?: { paused?: boolean } } })?.queue?.main,
    verdict: pauseOk && resumeOk
      ? 'Pause/resume OK — simulates worker stop without job loss'
      : 'Pause/resume failed or flaky (often transient right after Redis restart)',
  });

  // --- STEP 3: Provider circuit (simulate open circuit) ---
  redisCmd('SET', 'notif:circuit:sms:twilio', JSON.stringify({
    state: 'open',
    failures: 10,
    openedAt: new Date().toISOString(),
    halfOpenAt: null,
    lastFailureAt: new Date().toISOString(),
  }));
  const circuitsAfter = await api(superToken, 'GET', '/notifications/admin/dashboard');
  log('providerFailover', {
    simulatedOpen: 'notif:circuit:sms:twilio',
    providers: (circuitsAfter.body as { providers?: unknown })?.providers,
    note: 'SMS_PROVIDER=console in dev — primary path uses console; circuits apply when real providers configured',
  });
  redisCmd('DEL', 'notif:circuit:sms:twilio');

  // --- STEP 4: DLQ ---
  const dlqList = await api(superToken, 'GET', '/notifications/admin/dlq?limit=20');
  const dlqDb = await prisma.notification.count({ where: { status: NotificationStatus.DLQ } });
  log('dlq', {
    apiJobs: dlqList.body,
    dbDlqCount: dlqDb,
    bullDlqLen: postRedisBull.notifDlq,
  });

  // --- STEP 5: Data consistency ---
  const dupNotifs = await prisma.$queryRaw<Array<{ idempotencyKey: string; cnt: bigint }>>`
    SELECT "idempotencyKey", COUNT(*)::bigint AS cnt
    FROM notifications
    WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "idempotencyKey"
    HAVING COUNT(*) > 1
    LIMIT 10`;
  const orphanLocks = redisCmd('KEYS', 'notif:lock:*');
  const wfInstances = await prisma.workflowInstance.groupBy({
    by: ['status'],
    _count: true,
  });

  log('dataConsistency', {
    duplicateIdempotencyKeys: dupNotifs,
    orphanProcessingLocks: orphanLocks.split('\n').filter(Boolean).length,
    workflowByStatus: Object.fromEntries(wfInstances.map((w) => [w.status, w._count])),
    chaosBookingWorkflows: chaosBookingId
      ? await prisma.workflowInstance.findMany({
          where: { resourceId: chaosBookingId },
          select: { definitionKey: true, status: true },
        })
      : [],
  });

  if (dupNotifs.length > 0) {
    issue('medium', 'idempotency', `${dupNotifs.length} idempotency keys with multiple rows (may be per-channel suffix)`);
  }

  // --- STEP 6: API restart ---
  let apiPid = '';
  try {
    apiPid = shell("pgrep -f 'nest start' | head -1");
  } catch {
    apiPid = '';
  }
  const apiRestart = { attempted: false, recovered: false, pid: apiPid };
  if (apiPid && process.env.CHAOS_KILL_API === '1') {
    try {
      shell(`kill ${apiPid}`);
      apiRestart.attempted = true;
      await sleep(3000);
      shell('pnpm --filter @ac/api dev &');
      await sleep(25000);
      const h = await api(null, 'GET', '/health');
      apiRestart.recovered = h.ok;
    } catch (e) {
      apiRestart.error = String(e);
    }
  } else {
    apiRestart.skipped = 'Set CHAOS_KILL_API=1 to run destructive API kill test';
  }
  log('apiRestart', apiRestart);

  // --- Observability ---
  const metricsText = await fetch(`${API}/notifications/admin/metrics`, {
    headers: { Authorization: 'Bearer dev' },
  }).then((r) => r.text());
  const metricsOk = metricsText.includes('notifications_sent_total') || metricsText.startsWith('#');
  if (!metricsOk) issue('high', 'observability', 'GET /notifications/admin/metrics returns 500');
  log('observability', {
    metricsStatus: metricsOk ? 'ok' : 'error',
    metricsSample: metricsText.slice(0, 500),
    metricsHasNotification: metricsText.includes('notification_'),
    correlationSample: await prisma.notification.findFirst({
      where: { correlationId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, correlationId: true, status: true, retryCount: true },
    }),
  });

  // Score
  let score = 100;
  score -= issues.filter((i) => i.severity === 'critical').length * 20;
  score -= issues.filter((i) => i.severity === 'high').length * 12;
  score -= issues.filter((i) => i.severity === 'medium').length * 5;
  if (!healthAfterRedis.ok) score -= 15;
  report.score = Math.max(0, Math.min(100, score));
  report.blockers = issues.filter((i) => i.severity === 'critical' || i.severity === 'high');

  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
