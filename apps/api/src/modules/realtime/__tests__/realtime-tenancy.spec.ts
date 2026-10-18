import { DomainEventName, Permission } from '@ac/types';

import { RealtimeGateway, scopedRoom } from '../realtime.gateway';

function build() {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const prisma = {
    client: {
      booking: { findFirst: jest.fn() },
      technician: { findFirst: jest.fn() },
    },
  };
  const gw = new RealtimeGateway({} as never, prisma as never);
  gw.server = { to } as never;
  return { gw, to, emit, prisma };
}

function socket(permissions: string[], tenantId = 't1') {
  const joined: string[] = [];
  return {
    data: { userId: 'u1', tenantId, permissions },
    join: jest.fn(async (r: string) => {
      joined.push(r);
    }),
    leave: jest.fn(),
    joined,
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('RealtimeGateway tenancy', () => {
  it('namespaces every room except personal ones', () => {
    expect(scopedRoom('t1', 'dispatch:global')).toBe('t:t1:dispatch:global');
    expect(scopedRoom('t1', 'user:u1')).toBe('user:u1');
  });

  it('broadcasts stamped events only into the owning tenant’s rooms', async () => {
    const { gw, to } = build();
    gw.onBookingStatusChanged({
      id: 'e1',
      name: DomainEventName.BookingStatusChanged,
      occurredAt: '',
      actorId: null,
      tenantId: 't2',
      payload: { bookingId: 'b1' },
    } as never);
    await flush();
    expect(to).toHaveBeenCalledWith(['t:t2:booking:b1', 't:t2:dispatch:global']);
  });

  it('looks up the tenant for unstamped (background) events', async () => {
    const { gw, to, prisma } = build();
    prisma.client.technician.findFirst.mockResolvedValue({ tenantId: 't3' });
    gw.onLocationUpdated({ id: 'e2', name: DomainEventName.TechnicianLocationUpdated, occurredAt: '', actorId: null, payload: { technicianId: 'x' } } as never);
    await flush();
    expect(to.mock.calls[0][0]).toEqual(expect.arrayContaining(['t:t3:dispatch:global']));
  });

  it('never fans out tenant rooms when the tenant is unknown', async () => {
    const { gw, to } = build();
    gw.onAnyEvent({ id: 'e3', name: 'misc.thing', occurredAt: '', actorId: null, payload: {} } as never);
    await flush();
    expect(to).not.toHaveBeenCalled();
  });

  it('joins the caller’s own tenant copy of a room', async () => {
    const { gw } = build();
    const s = socket([Permission.DISPATCH_VIEW]);
    await expect(gw.handleSubscribe(s as never, { rooms: ['dispatch:global', 'user:someone-else'] })).resolves.toEqual({
      ok: true,
      rooms: ['dispatch:global'],
    });
    expect(s.joined).toEqual(['t:t1:dispatch:global']);
  });

  it('lets a technician follow only bookings assigned to them', async () => {
    const { gw, prisma } = build();
    const s = socket([Permission.BOOKING_READ]);
    prisma.client.booking.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'b2' });
    const res = await gw.handleSubscribe(s as never, { rooms: ['booking:b1', 'booking:b2'] });
    expect(res.rooms).toEqual(['booking:b2']);
  });
});
