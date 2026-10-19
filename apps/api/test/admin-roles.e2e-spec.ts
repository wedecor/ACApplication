import type { AuthPrincipal } from '@ac/auth';
import { type ExecutionContext, ValidationPipe, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/common/guards/jwt.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { RolesService } from '../src/modules/rbac/roles.service';

/**
 * Smoke e2e for custom roles — proves POST/PATCH/DELETE /admin/roles are routed,
 * the CreateRoleDto rejects bad input before the service runs, and the
 * authenticated principal reaches the service. Service rules (permission
 * escalation, delete guards) are covered by roles.service.spec.ts.
 */
describe('Admin roles HTTP (e2e)', () => {
  let app: NestFastifyApplication;
  const actor = { userId: 'u1', tenantId: 't1' } as unknown as AuthPrincipal;
  const roles = {
    create: jest.fn().mockResolvedValue({ id: 'r1', key: 'CUSTOM_REGIONAL_MANAGER', isCustom: true }),
    remove: jest.fn().mockResolvedValue({ id: 'r1' }),
    updateMeta: jest.fn().mockResolvedValue({ id: 'r1', name: 'Area lead' }),
  };

  beforeAll(async () => {
    // No live DB: authenticate as a fixed principal and stub the service.
    // The guards are APP_GUARD `useClass` providers, which overrideGuard cannot reach.
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = actor;
      return true;
    });
    jest.spyOn(RolesGuard.prototype, 'canActivate').mockReturnValue(true);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RolesService)
      .useValue(roles)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => jest.clearAllMocks());

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('POST /api/v1/admin/roles creates a custom role as the current user', async () => {
    const payload = { name: 'Regional manager', permissionKeys: ['booking:read', 'customer:read'] };
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/roles', payload });

    expect(res.statusCode).toBe(201);
    expect(roles.create).toHaveBeenCalledWith(actor, expect.objectContaining(payload));
  });

  it.each([
    ['a blank name', { name: '   ', permissionKeys: [] }],
    ['a malformed permission key', { name: 'Ops', permissionKeys: ['not a key'] }],
    ['duplicate permission keys', { name: 'Ops', permissionKeys: ['booking:read', 'booking:read'] }],
    ['an unknown field', { name: 'Ops', permissionKeys: [], key: 'SUPER_ADMIN' }],
  ])('POST /api/v1/admin/roles rejects %s with 400', async (_, payload) => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/roles', payload });

    expect(res.statusCode).toBe(400);
    expect(roles.create).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/admin/roles/:id renames a role', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/v1/admin/roles/r1', payload: { name: 'Area lead' } });

    expect(res.statusCode).toBe(200);
    expect(roles.updateMeta).toHaveBeenCalledWith(actor, 'r1', expect.objectContaining({ name: 'Area lead' }));
  });

  it('PATCH /api/v1/admin/roles/:id rejects a blank name with 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/v1/admin/roles/r1', payload: { name: '   ' } });

    expect(res.statusCode).toBe(400);
    expect(roles.updateMeta).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/admin/roles/:id removes the role as the current user', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/admin/roles/r1' });

    expect(res.statusCode).toBe(200);
    expect(roles.remove).toHaveBeenCalledWith(actor, 'r1');
  });
});
