#!/usr/bin/env tsx
/**
 * STEP 2 — Booking lifecycle + workflow/notification validation (read-only ops QA).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import { BOOKING_TRANSITIONS, BookingStatus } from '@ac/types';

const ROOT = process.env.PROJECT_ROOT ?? join(process.cwd(), '../..');
const REPORT_PATH = join(ROOT, 'scripts/ops-booking-lifecycle-report.json');
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

const PHONES = {
  dispatcher: process.env.QA_DISPATCHER_PHONE ?? '+919900000003',
  technician: process.env.QA_TECHNICIAN_PHONE ?? '+919900000004',
  admin: process.env.QA_ADMIN_PHONE ?? '+919900000002',
};

type ApiResult = { status: number; body: unknown };

async function api(
  token: string | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult> {
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
  return { status: res.status, body: data ?? raw };
}

async function login(phone: string): Promise<string> {
  const req = await api(null, 'POST', '/auth/otp/request', {
    destination: phone,
    purpose: 'LOGIN',
  });
  const devCode = (req.body as { devCode?: string })?.devCode;
  if (!devCode) throw new Error(`No devCode for ${phone}`);
  const ver = await api(null, 'POST', '/auth/otp/verify', { destination: phone, code: devCode });
  if (ver.status !== 200 && ver.status !== 201) throw new Error(`Login failed ${phone}: ${ver.status}`);
  return (ver.body as { accessToken: string }).accessToken;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testWs(token: string, rooms: string[]) {
  return new Promise<{ connected: boolean; joined: string[]; events: string[] }>((resolve) => {
    const events: string[] = [];
    const socket: Socket = io('http://localhost:4000', {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
      timeout: 5000,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      resolve({ connected: socket.connected, joined: [], events });
    }, 6000);

    socket.on('domain-event', (evt: { name?: string }) => {
      if (evt?.name) events.push(evt.name);
    });

    socket.on('connect', () => {
      socket.emit('subscribe', { rooms }, (ack: { rooms?: string[] }) => {
        clearTimeout(timer);
        setTimeout(() => {
          socket.disconnect();
          resolve({ connected: true, joined: ack?.rooms ?? [], events });
        }, 1500);
      });
    });
    socket.on('connect_error', () => {
      clearTimeout(timer);
      resolve({ connected: false, joined: [], events });
    });
  });
}

async function main() {
  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    stateMachine: { transitions: [] as unknown[], invalid: [] as unknown[] },
    operationalFlow: {} as Record<string, unknown>,
    workflows: [] as unknown[],
    notifications: {} as Record<string, unknown>,
    websocket: {} as Record<string, unknown>,
    invoicePayment: {} as Record<string, unknown>,
    queue: {} as Record<string, unknown>,
    timeline: {} as Record<string, unknown>,
    issues: [] as Array<{ severity: string; area: string; detail: string }>,
    score: 0,
  };

  const dispatcherToken = await login(PHONES.dispatcher);
  const technicianToken = await login(PHONES.technician);
  const adminToken = await login(PHONES.admin);

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) throw new Error('No default tenant');

  const city = await prisma.city.findFirst({ where: { tenantId: tenant.id } });
  const customer = await prisma.customer.findFirst({ where: { tenantId: tenant.id } });
  const technician = await prisma.technician.findFirst({
    where: { tenantId: tenant.id, phone: PHONES.technician },
  });
  if (!city || !customer || !technician) {
    throw new Error('Missing city/customer/technician — run ops-multi-user seed first');
  }

  const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const created = await api(dispatcherToken, 'POST', '/bookings', {
    customerId: customer.id,
    cityId: city.id,
    category: 'AC_SERVICING',
    scheduledAt,
    scheduledTimeSlot: '14:00-16:00',
    issueDescription: 'QA lifecycle test — AC not cooling',
    address: {
      line1: '42 Test Lane',
      city: city.name,
      state: city.state ?? 'Karnataka',
      pincode: '560001',
    },
    estimatedAmountMinor: 250000,
  });

  const bookingId = (created.body as { id?: string })?.id;
  if (!bookingId || created.status >= 300) {
    (report.issues as Array<{ severity: string; area: string; detail: string }>).push({
      severity: 'critical',
      area: 'booking',
      detail: `Create booking failed: ${created.status} ${JSON.stringify(created.body)}`,
    });
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  let booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  const flow: Record<string, unknown> = {
    bookingId,
    code: booking?.code,
    steps: [] as unknown[],
  };

  const recordStep = (name: string, res: ApiResult, expectedStatus?: number) => {
    (flow.steps as unknown[]).push({ name, status: res.status, expectedStatus, ok: res.status < 300 });
    return res;
  };

  // --- State machine: invalid ---
  recordStep(
    'assign-technician',
    await api(dispatcherToken, 'POST', `/bookings/${bookingId}/assign-technician`, {
      technicianId: technician.id,
    }),
  );
  booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  (flow as Record<string, unknown>).statusAfterAssign = booking?.status;

  const badSkip = await api(dispatcherToken, 'POST', `/bookings/${bookingId}/status`, {
    status: BookingStatus.IN_PROGRESS,
  });
  (report.stateMachine as { invalid: unknown[] }).invalid.push({
    from: booking?.status,
    to: BookingStatus.IN_PROGRESS,
    status: badSkip.status,
    rejected: badSkip.status === 403,
  });

  // --- Valid chain ---
  const chain: Array<{ status: string; token: string; actor: string; finalAmountMinor?: number }> =
    [
      { status: BookingStatus.TECHNICIAN_EN_ROUTE, token: technicianToken, actor: 'technician' },
      { status: BookingStatus.IN_PROGRESS, token: technicianToken, actor: 'technician' },
      {
        status: BookingStatus.COMPLETED,
        token: technicianToken,
        actor: 'technician',
        finalAmountMinor: 250000,
      },
    ];

  for (const step of chain) {
    const res = await api(step.token, 'POST', `/bookings/${bookingId}/status`, {
      status: step.status,
      ...(step.finalAmountMinor != null ? { finalAmountMinor: step.finalAmountMinor } : {}),
    });
    (report.stateMachine as { transitions: unknown[] }).transitions.push({
      to: step.status,
      actor: step.actor,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
    });
    await sleep(800);
  }

  booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  flow.finalStatus = booking?.status;

  // Timeline / activities
  const activities = await api(dispatcherToken, 'GET', `/bookings/${bookingId}/activities`);
  const activityRows = await prisma.bookingActivity.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
  });
  report.timeline = {
    apiCount: Array.isArray((activities.body as { items?: unknown[] })?.items)
      ? (activities.body as { items: unknown[] }).items.length
      : Array.isArray(activities.body)
        ? (activities.body as unknown[]).length
        : 0,
    dbCount: activityRows.length,
    types: activityRows.map((a) => a.type),
  };

  // Workflows
  await sleep(2000);
  const workflowInstances = await prisma.workflowInstance.findMany({
    where: { tenantId: tenant.id, resourceId: bookingId },
    include: { steps: true },
  });
  const allWorkflows = await prisma.workflowInstance.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { steps: true },
  });

  report.workflows = allWorkflows.map((w) => ({
    key: w.definitionKey,
    status: w.status,
    triggerEvent: w.triggerEvent,
    resourceId: w.resourceId,
    stepsExecuted: w.steps.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length,
    stepTotal: w.steps.length,
    failures: w.steps.filter((s) => s.status === 'FAILED').map((s) => s.stepKey),
  }));

  if (workflowInstances.length === 0) {
    (report.issues as Array<{ severity: string; area: string; detail: string }>).push({
      severity: 'high',
      area: 'workflow',
      detail: 'No workflow instance linked to bookingId after create/complete',
    });
  }

  // Notifications
  const notifications = await prisma.notification.findMany({
    where: { tenantId: tenant.id, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  report.notifications = {
    count: notifications.length,
    byStatus: notifications.reduce(
      (acc, n) => {
        acc[n.status] = (acc[n.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    templates: [...new Set(notifications.map((n) => n.template))],
    correlationIds: notifications.filter((n) => n.correlationId).length,
  };

  if (notifications.length === 0) {
    (report.issues as Array<{ severity: string; area: string; detail: string }>).push({
      severity: 'medium',
      area: 'notification',
      detail: 'No notifications in last 10 minutes — check listener/queue',
    });
  }

  // Invoice + payment
  const invoiceRes = await api(adminToken, 'POST', '/invoices', {
    customerId: customer.id,
    bookingId,
    lineItems: [
      {
        description: 'AC service — QA lifecycle',
        quantity: 1,
        unitPriceMinor: 250000,
        taxRateBps: 1800,
      },
    ],
    gstEnabled: true,
    placeOfSupply: 'Karnataka',
  });

  const invoiceId = (invoiceRes.body as { id?: string })?.id;
  report.invoicePayment = {
    invoiceCreate: { status: invoiceRes.status, invoiceId },
  };

  if (invoiceId) {
    const payRes = await api(adminToken, 'POST', `/invoices/${invoiceId}/payments`, {
      amountMinor: 250000,
      method: 'UPI',
      gatewayRef: `QA-PAY-${Date.now()}`,
    });
    report.invoicePayment = {
      ...(report.invoicePayment as object),
      payment: { status: payRes.status, body: payRes.body },
    };

    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    (report.invoicePayment as Record<string, unknown>).invoiceStatus = inv?.status;
    (report.invoicePayment as Record<string, unknown>).paymentStatus = inv?.paymentStatus;
  }

  // Queue stats (admin)
  const queueStats = await api(adminToken, 'GET', '/notifications/admin/metrics');
  report.queue = { queueStats: queueStats.status, body: queueStats.body };

  // WebSocket
  const bookingRoom = `booking:${bookingId}`;
  const dispatchRoom = 'dispatch:global';
  const secretRoom = 'secret:qa-room';

  const dispWs = await testWs(dispatcherToken, [dispatchRoom, bookingRoom]);
  const techWs = await testWs(technicianToken, [bookingRoom]);
  const badWs = await testWs(technicianToken, [secretRoom]);

  report.websocket = {
    dispatcher: dispWs,
    technician: techWs,
    unauthorizedRoom: { requested: secretRoom, joined: badWs.joined, rejected: badWs.joined.length === 0 },
  };

  // Domain events persisted
  const domainEvents = await prisma.domainEventRecord.findMany({
    where: { tenantId: tenant.id, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  flow.domainEvents = domainEvents.map((e) => e.name);

  report.operationalFlow = flow;

  // Registry reference for expected transitions
  (report.stateMachine as { expected: unknown }).expected = {
    CONFIRMED: BOOKING_TRANSITIONS[BookingStatus.CONFIRMED],
    ASSIGNED: BOOKING_TRANSITIONS[BookingStatus.ASSIGNED],
    TECHNICIAN_EN_ROUTE: BOOKING_TRANSITIONS[BookingStatus.TECHNICIAN_EN_ROUTE],
    IN_PROGRESS: BOOKING_TRANSITIONS[BookingStatus.IN_PROGRESS],
  };

  const issues = report.issues as Array<{ severity: string; area: string; detail: string }>;
  let score = 100;
  score -= issues.filter((i) => i.severity === 'critical').length * 25;
  score -= issues.filter((i) => i.severity === 'high').length * 15;
  score -= issues.filter((i) => i.severity === 'medium').length * 8;
  const transitions = (report.stateMachine as { transitions: { ok: boolean }[] }).transitions;
  if (transitions.some((t) => !t.ok)) score -= 20;
  if ((report.timeline as { dbCount: number }).dbCount < 3) score -= 10;
  report.score = Math.max(0, Math.min(100, score));

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
