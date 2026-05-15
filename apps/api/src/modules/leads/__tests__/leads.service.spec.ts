import { ConflictException, ForbiddenException } from '@nestjs/common';
import { LeadSource, LeadStatus } from '@ac/types';

import { LeadsService } from '../leads.service';

type RepoMock = {
  create: jest.Mock;
  findByExternalRef: jest.Mock;
  findRecentDuplicate: jest.Mock;
  findById: jest.Mock;
  update: jest.Mock;
  addNote: jest.Mock;
  nextCode: jest.Mock;
};

type PrismaMock = {
  client: {
    $transaction: jest.Mock;
    user: { findFirst: jest.Mock };
  };
};

function buildService() {
  const repo: RepoMock = {
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'lead_1', status: 'NEW', ...data })),
    findByExternalRef: jest.fn().mockResolvedValue(null),
    findRecentDuplicate: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    update: jest.fn(),
    addNote: jest.fn(),
    nextCode: jest.fn().mockResolvedValue('LD-2025-000001'),
  };
  const prisma: PrismaMock = {
    client: {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
      user: { findFirst: jest.fn() },
    },
  };
  const events = { publish: jest.fn() };
  const activity = {
    recordLeadActivity: jest.fn().mockResolvedValue(undefined),
    listLeadActivities: jest.fn(),
  };

  const service = new LeadsService(
    repo as never,
    prisma as never,
    events as never,
    activity as never,
  );
  return { service, repo, prisma, events, activity };
}

const actor = {
  userId: 'user_1',
  tenantId: 'tenant_1',
  sessionId: 's',
  roles: [],
  permissions: [],
  email: null,
  phone: null,
  iat: 0,
  exp: 0,
};

describe('LeadsService', () => {
  it('creates a lead and emits LeadCreated', async () => {
    const { service, repo, events } = buildService();

    const lead = await service.create(actor as never, {
      customerName: 'Jane Doe',
      phone: '+919876543210',
      source: LeadSource.WEBSITE,
    });

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(
      'lead.created',
      expect.objectContaining({ leadId: lead.id, source: 'WEBSITE' }),
    );
  });

  it('rejects duplicate leads inside the dedupe window', async () => {
    const { service, repo } = buildService();
    repo.findRecentDuplicate.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.create(actor as never, {
        customerName: 'Jane Doe',
        phone: '+919876543210',
        source: LeadSource.WEBSITE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the existing lead when externalRef collides (idempotent)', async () => {
    const { service, repo } = buildService();
    repo.findByExternalRef.mockResolvedValueOnce({ id: 'lead_existing' });

    const lead = await service.create(actor as never, {
      customerName: 'Jane Doe',
      phone: '+919876543210',
      source: LeadSource.WEBSITE,
      externalRef: 'ad-xyz',
    });

    expect(lead.id).toBe('lead_existing');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects invalid status transitions', async () => {
    const { service, repo } = buildService();
    repo.findById.mockResolvedValueOnce({
      id: 'lead_1',
      tenantId: 'tenant_1',
      status: LeadStatus.NEW,
    });

    await expect(
      service.changeStatus(actor as never, 'lead_1', { status: LeadStatus.BOOKING_CREATED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
