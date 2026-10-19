import { ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { otp } from '@ac/auth';
import { ActivityType, BookingStatus, Permission, UserRole } from '@ac/types';
import { Logger } from 'nestjs-pino';

import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { PermissionsLoader } from '../src/modules/auth/permissions.loader';
import { TokenService } from '../src/modules/auth/token.service';

/**
 * Booking lifecycle e2e: lead -> booking -> assign technician -> en-route ->
 * arrival OTP -> in progress -> completed -> invoice.
 *
 * Requires the local docker Postgres (migrated) + Redis.
 *
 * Auth: a real access token is minted with the app's TokenService for a
 * freshly-seeded user, and the real JwtAuthGuard + RolesGuard run. Only
 * PermissionsLoader.loadForUser is stubbed (SUPER_ADMIN + every permission)
 * so the spec does not have to seed RBAC role assignments. Note:
 * `overrideGuard(JwtAuthGuard)` does NOT work here because the guard is
 * registered via `APP_GUARD` (it is what leads.e2e-spec.ts attempts).
 *
 * Tenant: rows are created inside the FIRST existing tenant rather than a
 * fresh one, because lead/booking/invoice codes are sequenced per tenant but
 * are globally UNIQUE columns — a brand new tenant would collide on
 * `LD-<year>-000001` etc. Everything this spec creates uses a unique run
 * suffix (phones, employee code, city name) and is deleted in afterAll.
 */

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const TEST_OTP = '246810'; // obvious test value, written as a hash directly
const FINAL_AMOUNT_MINOR = 150_000;

function uniquePhone(): string {
  // +9199 followed by 8 pseudo-random digits — E.164 and unique per run.
  return `+9199${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

type Json = Record<string, unknown>;

describe('Booking lifecycle (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService['client'];

  let accessToken = '';
  const created = {
    users: [] as string[],
    customers: [] as string[],
    technicians: [] as string[],
    cities: [] as string[],
    leads: [] as string[],
    bookings: [] as string[],
    invoices: [] as string[],
    addresses: [] as string[],
  };

  let tenantId: string;
  let cityId: string;
  let customerId: string;
  let technicianId: string;
  let leadId: string;
  let bookingId: string;

  async function call(method: 'GET' | 'POST' | 'PATCH', url: string, payload?: Json) {
    const res = await app.getHttpAdapter().getInstance().inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = res.body ? (JSON.parse(res.body) as Json) : {};
    const data = body['success'] === true && 'data' in body ? (body['data'] as Json) : body;
    return { status: res.statusCode, body, data };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // Mirror main.ts wiring.
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(Logger)));
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService).client;

    // ── Seed ─────────────────────────────────────────────────────────────
    const tenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, rbacVersion: true },
    });
    if (!tenant) throw new Error('No tenant in DB — run the database seed first');
    tenantId = tenant.id;

    const city = await prisma.city.create({
      data: { tenantId, name: `E2E City ${RUN}`, state: 'Karnataka', pincodes: ['560001'] },
    });
    cityId = city.id;
    created.cities.push(city.id);

    const actorUser = await prisma.user.create({
      data: {
        tenantId,
        phone: uniquePhone(),
        firstName: 'E2E',
        lastName: `Dispatcher ${RUN}`,
        status: 'ACTIVE',
      },
    });
    created.users.push(actorUser.id);

    const custPhone = uniquePhone();
    const custUser = await prisma.user.create({
      data: { tenantId, phone: custPhone, firstName: 'E2E', lastName: `Customer ${RUN}`, status: 'ACTIVE' },
    });
    created.users.push(custUser.id);
    const customer = await prisma.customer.create({
      data: { tenantId, userId: custUser.id, cityId, fullName: `E2E Customer ${RUN}`, phone: custPhone },
    });
    customerId = customer.id;
    created.customers.push(customer.id);

    const techPhone = uniquePhone();
    const techUser = await prisma.user.create({
      data: { tenantId, phone: techPhone, firstName: 'E2E', lastName: `Tech ${RUN}`, status: 'ACTIVE' },
    });
    created.users.push(techUser.id);
    const technician = await prisma.technician.create({
      data: {
        tenantId,
        userId: techUser.id,
        cityId,
        employeeCode: `E2E-${RUN}`,
        fullName: `E2E Tech ${RUN}`,
        phone: techPhone,
        skills: ['AC_REPAIR'],
        status: 'AVAILABLE',
      },
    });
    technicianId = technician.id;
    created.technicians.push(technician.id);

    jest.spyOn(app.get(PermissionsLoader), 'loadForUser').mockImplementation(async (userId: string) => {
      if (userId !== actorUser.id) throw new Error('unexpected user in e2e');
      return { roles: [UserRole.SUPER_ADMIN], permissions: Object.values(Permission) };
    });
    // The guard requires a live session row for the token's sid (revocation check).
    await prisma.session.create({
      data: {
        id: `e2e-${RUN}`,
        userId: actorUser.id,
        refreshTokenHash: `e2e-refresh-${RUN}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const pair = await app.get(TokenService).issueTokens(
      {
        sub: actorUser.id,
        tid: tenantId,
        sid: `e2e-${RUN}`,
        roles: [UserRole.SUPER_ADMIN],
        permissions: [],
        pv: tenant.rbacVersion,
      },
      `e2e-${RUN}`,
    );
    accessToken = pair.accessToken;
  });

  afterAll(async () => {
    // Give async (@OnEvent async) listeners a moment to finish writing.
    await new Promise((r) => setTimeout(r, 1500));
    if (prisma) {
      if (bookingId) {
        const addr = await prisma.booking.findUnique({ where: { id: bookingId }, select: { addressId: true } });
        if (addr?.addressId) created.addresses.push(addr.addressId);
      }
      await cleanup(prisma, created);
    }
    if (app) await app.close();
  });

  it('1. creates a lead', async () => {
    const res = await call('POST', '/leads', {
      customerName: `E2E Customer ${RUN}`,
      phone: uniquePhone(),
      source: 'CALL',
      applianceType: 'AC_REPAIR',
      issueDescription: 'AC not cooling',
      cityId,
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual(expect.objectContaining({ id: expect.any(String), status: 'NEW' }));
    leadId = res.data['id'] as string;
    created.leads.push(leadId);
  });

  it('2. converts the lead into a PENDING booking', async () => {
    const scheduledAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const res = await call('POST', `/bookings/from-lead/${leadId}`, {
      booking: {
        customerId,
        cityId,
        category: 'AC_REPAIR',
        scheduledAt,
        scheduledTimeSlot: '10:00-12:00',
        estimatedAmountMinor: 120_000,
        address: { line1: '1 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      },
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual(
      expect.objectContaining({ id: expect.any(String), status: BookingStatus.PENDING, leadId }),
    );
    bookingId = res.data['id'] as string;
    created.bookings.push(bookingId);

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, bookingId: true } });
    expect(lead).toEqual({ status: 'BOOKING_CREATED', bookingId });
  });

  it('2b. refuses to convert the same lead twice', async () => {
    const res = await call('POST', `/bookings/from-lead/${leadId}`, {
      booking: {
        customerId,
        cityId,
        category: 'AC_REPAIR',
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        address: { line1: '1 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      },
    });
    expect(res.status).toBe(409);
  });

  it('3. assigns the technician (PENDING -> ASSIGNED)', async () => {
    const res = await call('POST', `/bookings/${bookingId}/assign-technician`, { technicianId });
    expect(res.status).toBe(201);
    expect(res.data).toEqual(expect.objectContaining({ status: BookingStatus.ASSIGNED, technicianId }));
  });

  it('3b. rejects a forbidden transition (ASSIGNED -> COMPLETED) with 403', async () => {
    const res = await call('POST', `/bookings/${bookingId}/status`, { status: BookingStatus.COMPLETED });
    expect(res.status).toBe(403);
  });

  it('4. technician goes en-route', async () => {
    const res = await call('POST', `/bookings/${bookingId}/status`, {
      status: BookingStatus.TECHNICIAN_EN_ROUTE,
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual(expect.objectContaining({ status: BookingStatus.TECHNICIAN_EN_ROUTE }));
  });

  it('5. issues an arrival OTP and starts the job on correct verification', async () => {
    const send = await call('POST', `/bookings/${bookingId}/otp/send`);
    expect(send.status).toBe(202);

    const issued = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { otpCodeHash: true, otpExpiresAt: true, otpAttempts: true },
    });
    expect(issued?.otpCodeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued?.otpExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    expect(issued?.otpAttempts).toBe(0);

    // The real code is delivered out-of-band; pin a known test code.
    await prisma.booking.update({ where: { id: bookingId }, data: { otpCodeHash: otp.hash(TEST_OTP) } });

    const wrong = await call('POST', `/bookings/${bookingId}/verify-otp`, { code: '000000' });
    expect(wrong.status).toBe(403);
    const afterWrong = await prisma.booking.findUnique({ where: { id: bookingId }, select: { otpAttempts: true } });
    expect(afterWrong?.otpAttempts).toBe(1);

    const ok = await call('POST', `/bookings/${bookingId}/verify-otp`, { code: TEST_OTP });
    expect(ok.status).toBe(201);
    expect(ok.data).toEqual(
      expect.objectContaining({ status: BookingStatus.IN_PROGRESS, otpVerifiedAt: expect.any(String) }),
    );

    const again = await call('POST', `/bookings/${bookingId}/verify-otp`, { code: TEST_OTP });
    expect(again.status).toBe(409);
  });

  it('6. completes the booking with a final amount', async () => {
    const res = await call('POST', `/bookings/${bookingId}/status`, {
      status: BookingStatus.COMPLETED,
      finalAmountMinor: FINAL_AMOUNT_MINOR,
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual(
      expect.objectContaining({
        status: BookingStatus.COMPLETED,
        finalAmountMinor: FINAL_AMOUNT_MINOR,
        completedAt: expect.any(String),
      }),
    );

    const reopen = await call('POST', `/bookings/${bookingId}/status`, { status: BookingStatus.IN_PROGRESS });
    expect(reopen.status).toBe(403);
  });

  // NOTE: currently fails with 500 against real Postgres — production bug in
  // src/common/finance/numbering.ts:53: `pg_advisory_xact_lock(bigint, bigint)`
  // does not exist (the two-key overload is (int4, int4)). Left asserting the
  // correct behaviour on purpose so it goes green once numbering is fixed.
  it('7. invoices the completed booking', async () => {
    const res = await call('POST', '/invoices', {
      customerId,
      bookingId,
      lineItems: [
        { description: 'AC repair service', quantity: 1, unitPriceMinor: FINAL_AMOUNT_MINOR, taxRateBps: 1800 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        bookingId,
        customerId,
        status: 'DRAFT',
        subtotalMinor: FINAL_AMOUNT_MINOR,
      }),
    );
    expect(res.data['totalMinor']).toBeGreaterThanOrEqual(FINAL_AMOUNT_MINOR);
    created.invoices.push(res.data['id'] as string);

    const dupe = await call('POST', '/invoices', {
      customerId,
      bookingId,
      lineItems: [{ description: 'dup', quantity: 1, unitPriceMinor: 1 }],
    });
    expect(dupe.status).toBe(409);
  });

  it('8. records the full timeline', async () => {
    const res = await call('GET', `/bookings/${bookingId}/activities`);
    expect(res.status).toBe(200);
    const items = (Array.isArray(res.data) ? res.data : (res.data['items'] as unknown[])) as Json[];
    const types = items.map((a) => a['type']);
    for (const t of [
      ActivityType.CREATED,
      ActivityType.ASSIGNED,
      ActivityType.TECHNICIAN_EN_ROUTE,
      ActivityType.OTP_SENT,
      ActivityType.OTP_VERIFIED,
      ActivityType.COMPLETED,
    ]) {
      expect(types).toContain(t);
    }
  });
});

/**
 * Delete everything this spec created. Rows written by side-effect listeners
 * (activities, notifications, commissions, audit logs, ...) are found via the
 * foreign keys that point at our root rows, so the cleanup does not need to
 * know every module. Multiple passes resolve FK ordering.
 */
async function cleanup(
  prisma: PrismaService['client'],
  ids: Record<'users' | 'customers' | 'technicians' | 'cities' | 'leads' | 'bookings' | 'invoices' | 'addresses', string[]>,
): Promise<void> {
  const roots: Array<[table: string, ids: string[]]> = [
    ['invoices', ids.invoices],
    ['bookings', ids.bookings],
    ['leads', ids.leads],
    ['addresses', ids.addresses],
    ['technicians', ids.technicians],
    ['customers', ids.customers],
    ['users', ids.users],
    ['cities', ids.cities],
  ];
  const allIds = roots.flatMap(([, v]) => v);
  if (allIds.length === 0) return;

  const fks = await prisma.$queryRawUnsafe<Array<{ tbl: string; col: string; ref: string }>>(`
    SELECT kcu.table_name AS tbl, kcu.column_name AS col, ccu.table_name AS ref
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  const rootIds = new Map(roots);
  const errors: string[] = [];
  for (let pass = 0; pass < 6; pass++) {
    errors.length = 0;
    // 1) dependents of our root rows
    for (const fk of fks) {
      const targetIds = rootIds.get(fk.ref);
      if (!targetIds?.length) continue;
      if (rootIds.has(fk.tbl)) continue; // root tables are deleted explicitly below
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "${fk.tbl}" WHERE "${fk.col}" = ANY($1::text[])`,
          targetIds,
        );
      } catch (e) {
        errors.push(`${fk.tbl}.${fk.col}: ${(e as Error).message.split('\n').pop()}`);
      }
    }
    // 2) the root rows themselves
    for (const [table, list] of roots) {
      if (!list.length) continue;
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "id" = ANY($1::text[])`, list);
      } catch (e) {
        errors.push(`${table}: ${(e as Error).message.split('\n').pop()}`);
      }
    }
    if (errors.length === 0) return;
  }
  // eslint-disable-next-line no-console
  console.warn(`[booking-lifecycle e2e] cleanup incomplete:\n${errors.join('\n')}`);
}
