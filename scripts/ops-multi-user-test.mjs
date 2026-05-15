#!/usr/bin/env node
/**
 * Multi-user operational QA — seeds test actors, exercises OTP/RBAC/API/WS, prints JSON report.
 * Usage: node scripts/ops-multi-user-test.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { io } = require('../node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/dist/socket.io.js');
const Redis = require('../node_modules/.pnpm/ioredis@5.10.1/node_modules/ioredis/built/index.js');
const { PrismaClient } = require('../packages/database/node_modules/@prisma/client');
const { otp } = require('../packages/auth/dist/index.js');
const prisma = new PrismaClient();

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';

const OPS_USERS = [
  { phone: '+919900000001', firstName: 'Ravi', lastName: 'Sharma', role: 'SUPER_ADMIN' },
  { phone: '+919900000002', firstName: 'Priya', lastName: 'Nair', role: 'ADMIN' },
  { phone: '+919900000003', firstName: 'Amit', lastName: 'Verma', role: 'DISPATCHER' },
  { phone: '+919900000004', firstName: 'Suresh', lastName: 'Kumar', role: 'TECHNICIAN' },
  { phone: '+919900000005', firstName: 'Meera', lastName: 'Iyer', role: 'CALL_CENTER_AGENT' },
  { phone: '+919900000006', firstName: 'Anita', lastName: 'Desai', role: 'CUSTOMER' },
];

const ROUTE_PERMISSIONS = {
  '/': [],
  '/dispatch': ['dispatch:view'],
  '/live-map': ['technician:track'],
  '/leads': ['lead:view'],
  '/bookings': ['booking:read'],
  '/customers': ['customer:read'],
  '/technicians': ['technician:track'],
  '/finance': ['finance:view'],
  '/invoices': ['invoice:view'],
  '/payments': ['payment:view'],
  '/amc': ['amc:view'],
  '/payouts': ['payout:view'],
  '/inventory': ['inventory:view'],
  '/warehouses': ['warehouse:view'],
  '/vendors': ['vendor:view'],
  '/purchase-orders': ['purchase_order:view'],
  '/transfers': ['stock_transfer:view'],
  '/inventory-alerts': ['inventory_alert:view'],
  '/support': ['ticket:view'],
  '/inbox': ['inbox:view'],
  '/tickets': ['ticket:view'],
  '/call-center': ['call:view'],
  '/csat': ['support_analytics:view'],
  '/knowledge-base': ['kb:view'],
  '/sla': ['sla:view'],
  '/canned-responses': ['canned_response:view'],
  '/notifications': ['notification:view'],
  '/automation': ['workflow:view'],
  '/settings': [],
};

const API_CHECKS = [
  { name: 'bookings:list', method: 'GET', path: '/bookings', perm: 'booking:read' },
  { name: 'dispatch:unassigned', method: 'GET', path: '/dispatch/unassigned', perm: 'dispatch:view' },
  { name: 'invoices:list', method: 'GET', path: '/invoices', perm: 'invoice:view' },
  { name: 'finance:overview', method: 'GET', path: '/finance/overview', perm: 'finance:view' },
  { name: 'tickets:list', method: 'GET', path: '/support/tickets', perm: 'ticket:view' },
  { name: 'workflows:list', method: 'GET', path: '/orchestration/workflows', perm: 'workflow:view' },
  { name: 'notifications:admin', method: 'GET', path: '/notifications/admin/queue-stats', perm: 'notification:view' },
  { name: 'users:manage', method: 'GET', path: '/users', perm: 'user:manage' },
];

function decodeJwt(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return payload;
}

function hasPerm(granted, required) {
  if (granted.includes('*')) return true;
  return granted.includes(required);
}

function hasAll(granted, required) {
  return required.every((p) => hasPerm(granted, p));
}

function sidebarVisible(granted, route) {
  const req = ROUTE_PERMISSIONS[route] ?? [];
  return req.length === 0 || hasAll(granted, req);
}

async function upsertOpsUsers(tenantId) {
  const created = [];
  for (const spec of OPS_USERS) {
    const user = await prisma.user.upsert({
      where: { phone: spec.phone },
      update: {
        tenantId,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phoneVerified: true,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        tenantId,
        phone: spec.phone,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phoneVerified: true,
        status: 'ACTIVE',
      },
    });
    const role = await prisma.role.findUniqueOrThrow({
      where: { tenantId_key: { tenantId, key: spec.role } },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    const perms = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    created.push({
      ...spec,
      userId: user.id,
      permissions: perms.map((p) => p.permission.key),
    });
  }
  return created;
}

async function seedOperationalData(tenantId, users) {
  const city = await prisma.city.findFirst({ where: { tenantId } });
  if (!city) throw new Error('No city in tenant');

  const customerUser = users.find((u) => u.role === 'CUSTOMER');
  const techUser = users.find((u) => u.role === 'TECHNICIAN');
  const dispatcher = users.find((u) => u.role === 'DISPATCHER');

  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.userId },
    update: { fullName: 'Anita Desai (Ops)', phone: customerUser.phone },
    create: {
      tenantId,
      userId: customerUser.userId,
      cityId: city.id,
      fullName: 'Anita Desai (Ops)',
      phone: customerUser.phone,
      email: 'anita.ops@test.local',
    },
  });

  let technician = await prisma.technician.findFirst({
    where: { tenantId, userId: techUser.userId },
  });
  if (!technician) {
    technician = await prisma.technician.create({
      data: {
        tenantId,
        userId: techUser.userId,
        cityId: city.id,
        employeeCode: 'TECH-OPS-001',
        fullName: `${techUser.firstName} ${techUser.lastName}`,
        phone: techUser.phone,
        skills: ['AC_SERVICING'],
        status: 'ONLINE',
      },
    });
  }

  let address = await prisma.address.findFirst({
    where: { customerId: customer.id, deletedAt: null },
  });
  if (!address) {
    address = await prisma.address.create({
      data: {
        customerId: customer.id,
        line1: '12 MG Road',
        city: city.name,
        state: city.state ?? 'Karnataka',
        pincode: '560001',
        country: 'IN',
      },
    });
  }

  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  let booking = await prisma.booking.findFirst({
    where: { tenantId, customerId: customer.id, deletedAt: null },
  });
  if (!booking) {
    booking = await prisma.booking.create({
      data: {
        tenantId,
        customerId: customer.id,
        cityId: city.id,
        addressId: address.id,
        code: `OPS-${Date.now().toString(36).toUpperCase()}`,
        category: 'AC_SERVICING',
        status: 'CONFIRMED',
        priority: 'STANDARD',
        scheduledAt,
        scheduledTimeSlot: '10:00-12:00',
        addressSnapshot: {
          line1: '12 MG Road',
          city: city.name,
          state: city.state ?? 'Karnataka',
          pincode: '560001',
          country: 'IN',
        },
        createdBy: dispatcher.userId,
      },
    });
  }

  return { city, customer, technician, booking };
}

async function requestOtp(phone) {
  const res = await fetch(`${API}/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination: phone, purpose: 'LOGIN' }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, devCode: body?.data?.devCode ?? null };
}

const API_LOG_CANDIDATES = [
  join(homedir(), '.cursor/projects/home-nmc-40324-Desktop-AC-Project/terminals/958535.txt'),
  join(homedir(), '.cursor/projects/home-nmc-40324-Desktop-AC-Project/terminals/621271.txt'),
];

async function readOtpFromRedis(phone) {
  const key = `auth:otp:${phone}`;
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  try {
    const val = await redis.get(key);
    if (val) return JSON.parse(val);
  } finally {
    redis.disconnect();
  }
  return null;
}

function readOtpFromApiLog(phone) {
  for (const path of API_LOG_CANDIDATES) {
    if (!existsSync(path)) continue;
    const log = readFileSync(path, 'utf8');
    const re = new RegExp(`\\[DEV\\] OTP for ${phone.replace(/[+]/g, '\\+')}: (\\d{6})`, 'g');
    let match;
    let last = null;
    while ((match = re.exec(log)) !== null) last = match[1];
    if (last) return last;
  }
  return null;
}

async function verifyOtp(phone, code) {
  const res = await fetch(`${API}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination: phone, code }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body?.data ?? body };
}

async function loginWithOtp(phone) {
  const issued = await requestOtp(phone);
  let code = issued.devCode ?? readOtpFromApiLog(phone);
  if (!code) {
    const entry = await readOtpFromRedis(phone);
    if (entry?.hash) {
      const secret = process.env.JWT_SECRET ?? 'change-me-use-openssl-rand-base64-32-min-chars';
      for (let i = 0; i < 1_000_000; i++) {
        const candidate = String(i).padStart(6, '0');
        if (otp.verify(candidate, entry.hash, secret)) {
          code = candidate;
          break;
        }
      }
    }
  }
  if (!code) return { ok: false, error: 'OTP not found (devCode / Redis / log)' };
  const result = await verifyOtp(phone, code);
  if (result.status === 200 || result.status === 201) {
    return { ok: true, tokens: result.body };
  }
  return { ok: false, error: result.body };
}

async function apiFetch(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.json().catch(() => null);
  return { status: res.status, body: raw?.data ?? raw };
}

async function testWebSocket(token, rooms) {
  return new Promise((resolve) => {
    const socket = io('http://localhost:4000', {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
      timeout: 5000,
    });
    const result = { connected: false, subscribe: null, error: null };
    const timer = setTimeout(() => {
      socket.disconnect();
      resolve({ ...result, error: result.error ?? 'timeout' });
    }, 8000);

    socket.on('connect', () => {
      result.connected = true;
      socket.emit('subscribe', { rooms }, (ack) => {
        result.subscribe = ack;
        clearTimeout(timer);
        socket.disconnect();
        resolve(result);
      });
    });
    socket.on('connect_error', (err) => {
      result.error = err.message;
    });
  });
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    step1_users: [],
    step2_seed: {},
    step3_frontend: [],
    step4_operational: {},
    step5_websocket: [],
    step6_issues: [],
    scores: {},
  };

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) throw new Error('Default tenant missing — run pnpm db:seed');

  const users = await upsertOpsUsers(tenant.id);
  report.step2_seed = await seedOperationalData(tenant.id, users);

  for (const u of users) {
    const rolePerms = u.permissions;
    const login = await loginWithOtp(u.phone);
    const row = {
      user: `${u.firstName} ${u.lastName}`,
      phone: u.phone,
      role: u.role,
      permissionCount: rolePerms.length,
      permissionsSample: rolePerms.slice(0, 8),
      loginOk: login.ok,
      jwtPermissionsMatchDb: null,
      usersMePermissionsCount: null,
    };

    const accessToken = login.tokens?.accessToken;
    if (login.ok && accessToken) {
      const jwt = decodeJwt(accessToken);
      const jwtPerms = jwt.permissions ?? [];
      const dbSet = new Set(rolePerms);
      const jwtSet = new Set(jwtPerms);
      row.jwtPermissionsMatchDb =
        jwtPerms.length === rolePerms.length && [...dbSet].every((p) => jwtSet.has(p));
      row.jwtPermissionCount = jwtPerms.length;
      row.jwtRoles = jwt.roles ?? [];

      const me = await apiFetch(accessToken, 'GET', '/users/me');
      row.usersMePermissionsCount = me.body?.permissions?.length ?? 0;

      const granted = jwtPerms.includes('*') ? ['*', ...jwtPerms] : jwtPerms;
      const routes = Object.keys(ROUTE_PERMISSIONS).map((route) => ({
        route,
        visible: sidebarVisible(granted, route),
        required: ROUTE_PERMISSIONS[route],
      }));
      report.step3_frontend.push({ role: u.role, routes });

      const apiResults = [];
      for (const check of API_CHECKS) {
        const res = await apiFetch(accessToken, check.method, check.path);
        const expectAllow = hasPerm(granted, check.perm) || check.perm === 'user:manage' && hasPerm(granted, '*');
        const allowed = res.status >= 200 && res.status < 300;
        const mismatch = expectAllow !== allowed && res.status !== 404;
        apiResults.push({
          check: check.name,
          status: res.status,
          expected: expectAllow ? 'allow' : 'deny',
          actual: allowed ? 'allow' : 'deny',
          mismatch,
        });
      }
      row.apiChecks = apiResults;

      const wsTests = [
        { rooms: [`tenant:${tenant.id}`], expectJoin: true },
        { rooms: ['dispatch:global'], expectJoin: hasPerm(granted, 'dispatch:view') },
        { rooms: ['finance:global'], expectJoin: hasPerm(granted, 'finance:view') },
        { rooms: ['booking:fake-id'], expectJoin: hasPerm(granted, 'booking:read') },
        { rooms: ['secret:room'], expectJoin: false },
      ];
      for (const t of wsTests) {
        const ws = await testWebSocket(accessToken, t.rooms);
        const joined = ws.subscribe?.rooms ?? [];
        const ok =
          ws.connected &&
          (t.expectJoin ? joined.length === t.rooms.length : joined.length === 0);
        report.step5_websocket.push({
          role: u.role,
          rooms: t.rooms,
          connected: ws.connected,
          joined,
          expectJoin: t.expectJoin,
          ok,
          error: ws.error,
        });
        if (!ok) {
          report.step6_issues.push({
            severity: 'medium',
            area: 'websocket',
            role: u.role,
            detail: `Room ${t.rooms.join(',')} expected join=${t.expectJoin}, got ${joined.join(',')}`,
          });
        }
      }

      row.tokens = { hasAccess: true };
    } else {
      row.loginError = login.error;
      report.step6_issues.push({
        severity: 'high',
        area: 'auth',
        role: u.role,
        phone: u.phone,
        detail: String(login.error),
      });
    }

    report.step1_users.push(row);
  }

  const seeded = report.step2_seed;
  const dispatcher = users.find((u) => u.role === 'DISPATCHER');
  const dispLogin = await loginWithOtp(dispatcher.phone);
  if (dispLogin.ok && dispLogin.tokens?.accessToken) {
    const token = dispLogin.tokens.accessToken;
    const assign = await apiFetch(
      token,
      'POST',
      `/bookings/${seeded.booking.id}/assign-technician`,
      { technicianId: seeded.technician.id },
    );
    report.step4_operational.assignTechnician = {
      status: assign.status,
      body: assign.body,
    };

    const status = await apiFetch(token, 'POST', `/bookings/${seeded.booking.id}/status`, {
      status: 'IN_PROGRESS',
    });
    report.step4_operational.updateStatus = { status: status.status };

    const workflows = await apiFetch(token, 'GET', '/orchestration/workflows?pageSize=5');
    report.step4_operational.workflowInstances = {
      status: workflows.status,
      count: Array.isArray(workflows.body?.items) ? workflows.body.items.length : workflows.body,
    };
  }

  const mismatches = report.step1_users.flatMap((u) =>
    (u.apiChecks ?? []).filter((c) => c.mismatch).map((c) => ({ role: u.role, ...c })),
  );
  if (mismatches.length) {
    report.step6_issues.push({
      severity: 'high',
      area: 'rbac',
      detail: 'API permission mismatches',
      items: mismatches,
    });
  }

  const techUser = users.find((u) => u.role === 'TECHNICIAN');
  const techRoutes = report.step3_frontend.find((r) => r.role === 'TECHNICIAN');
  const techVisibleFinance = techRoutes?.routes?.filter((r) => r.route.startsWith('/finance') && r.visible);
  if (techVisibleFinance?.length) {
    report.step6_issues.push({
      severity: 'low',
      area: 'frontend',
      detail: 'Technician sees finance routes in sidebar model',
    });
  }

  const loginFails = report.step1_users.filter((u) => !u.loginOk).length;
  const wsFails = report.step5_websocket.filter((w) => !w.ok).length;
  const rbacFails = mismatches.length;
  let score = 100;
  score -= loginFails * 15;
  score -= rbacFails * 5;
  score -= wsFails * 3;
  score -= report.step6_issues.filter((i) => i.severity === 'high').length * 10;
  report.scores.productionReadiness = Math.max(0, Math.min(100, score));

  const outPath = 'scripts/ops-multi-user-test-report.json';
  const json = JSON.stringify(
    report,
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  );
  writeFileSync(outPath, json);
  console.log(json);
  console.log(`\nWrote ${outPath}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
