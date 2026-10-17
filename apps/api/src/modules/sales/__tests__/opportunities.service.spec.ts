import { BadRequestException, ConflictException } from '@nestjs/common';
import { OpportunityStage } from '@prisma/client';

import {
  OpportunitiesService,
  stageTransition,
  summarisePipeline,
} from '../opportunities.service';

const actor = {
  userId: 'user_1',
  tenantId: 'tenant_1',
  sessionId: 's',
  roles: [],
  permissions: [],
  email: null,
  phone: null,
  permissionVersion: 1,
  iat: 0,
  exp: 0,
} as never;

describe('stageTransition', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('stamps closedAt and probability 100 on WON', () => {
    const data = stageTransition({ stage: OpportunityStage.NEGOTIATION, closedAt: null }, OpportunityStage.WON, undefined, now);
    expect(data).toEqual({ stage: 'WON', probabilityPct: 100, closedAt: now, lostReason: null });
  });

  it('requires lostReason for LOST', () => {
    expect(() =>
      stageTransition({ stage: OpportunityStage.NEW, closedAt: null }, OpportunityStage.LOST, '  ', now),
    ).toThrow(BadRequestException);
  });

  it('stamps closedAt + lostReason on LOST', () => {
    const data = stageTransition({ stage: OpportunityStage.PROPOSAL, closedAt: null }, OpportunityStage.LOST, ' price ', now);
    expect(data).toMatchObject({ stage: 'LOST', probabilityPct: 0, closedAt: now, lostReason: 'price' });
  });

  it('clears closedAt and lostReason when reopened', () => {
    const data = stageTransition({ stage: OpportunityStage.LOST, closedAt: now }, OpportunityStage.QUALIFIED, undefined);
    expect(data).toEqual({ stage: 'QUALIFIED', probabilityPct: 25, closedAt: null, lostReason: null });
  });
});

describe('summarisePipeline', () => {
  it('aggregates count, value and weighted forecast per stage', () => {
    const s = summarisePipeline([
      { stage: OpportunityStage.NEW, valueMinor: 10_000, probabilityPct: 10 },
      { stage: OpportunityStage.PROPOSAL, valueMinor: 20_000, probabilityPct: 50 },
      { stage: OpportunityStage.PROPOSAL, valueMinor: 333, probabilityPct: 33 },
      { stage: OpportunityStage.WON, valueMinor: 50_000, probabilityPct: 100 },
      { stage: OpportunityStage.LOST, valueMinor: 7_000, probabilityPct: 0 },
    ]);
    expect(s.stages).toHaveLength(6);
    const proposal = s.stages.find((x) => x.stage === 'PROPOSAL')!;
    expect(proposal).toEqual({ stage: 'PROPOSAL', count: 2, valueMinor: 20_333, weightedMinor: 10_110 });
    expect(s.openCount).toBe(3);
    expect(s.openValueMinor).toBe(30_333);
    expect(s.weightedForecastMinor).toBe(1_000 + 10_110);
    expect(s.wonValueMinor).toBe(50_000);
    expect(s.wonCount).toBe(1);
    expect(s.lostCount).toBe(1);
    expect(s.winRatePct).toBe(50);
  });

  it('handles empty pipeline', () => {
    const s = summarisePipeline([]);
    expect(s.openCount).toBe(0);
    expect(s.winRatePct).toBe(0);
  });
});

describe('OpportunitiesService', () => {
  function build() {
    const prisma = {
      client: {
        opportunity: {
          findFirst: jest.fn(),
          update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'opp_1', ...data })),
          create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'opp_new', ...data })),
          findMany: jest.fn(),
        },
        lead: { findFirst: jest.fn() },
        customer: { findFirst: jest.fn().mockResolvedValue(null) },
        account: { findFirst: jest.fn() },
      },
    };
    return { service: new OpportunitiesService(prisma as never), prisma };
  }

  it('changeStage to WON writes closedAt and updatedBy', async () => {
    const { service, prisma } = build();
    prisma.client.opportunity.findFirst.mockResolvedValue({ id: 'opp_1', stage: 'NEGOTIATION', closedAt: null });
    await service.changeStage(actor, 'opp_1', { stage: OpportunityStage.WON });
    const data = prisma.client.opportunity.update.mock.calls[0][0].data;
    expect(data.stage).toBe('WON');
    expect(data.closedAt).toBeInstanceOf(Date);
    expect(data.updatedBy).toBe('user_1');
  });

  it('pipeline scopes to tenant and non-deleted rows', async () => {
    const { service, prisma } = build();
    prisma.client.opportunity.findMany.mockResolvedValue([
      { stage: 'NEW', valueMinor: 100, probabilityPct: 10 },
    ]);
    const res = await service.pipeline(actor);
    expect(prisma.client.opportunity.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant_1', deletedAt: null });
    expect(res.weightedForecastMinor).toBe(10);
  });

  it('createFromLead rejects when an open opportunity exists', async () => {
    const { service, prisma } = build();
    prisma.client.lead.findFirst.mockResolvedValue({ id: 'lead_1', customerName: 'A', phone: '+91', booking: null });
    prisma.client.opportunity.findFirst.mockResolvedValue({ id: 'opp_x' });
    await expect(service.createFromLead(actor, 'lead_1', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('createFromLead creates a QUALIFIED opportunity linked to the lead', async () => {
    const { service, prisma } = build();
    prisma.client.lead.findFirst.mockResolvedValue({
      id: 'lead_1',
      customerName: 'Asha',
      applianceType: 'AC',
      assignedUserId: 'agent_1',
      phone: '+919999999999',
      booking: { customerId: 'cust_1' },
    });
    prisma.client.opportunity.findFirst.mockResolvedValue(null);
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'cust_1' });
    const res = await service.createFromLead(actor, 'lead_1', { valueMinor: 5000 });
    expect(res).toMatchObject({
      leadId: 'lead_1',
      customerId: 'cust_1',
      stage: 'QUALIFIED',
      probabilityPct: 25,
      ownerUserId: 'agent_1',
      valueMinor: 5000,
      title: 'Asha — AC',
    });
  });
});
