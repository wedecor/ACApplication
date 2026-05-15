import { TicketStatus, canTransitionTicket } from '../enums';

describe('canTransitionTicket', () => {
  it('allows the canonical happy path: OPEN → PENDING → RESOLVED → CLOSED', () => {
    expect(canTransitionTicket(TicketStatus.OPEN, TicketStatus.PENDING)).toBe(true);
    expect(canTransitionTicket(TicketStatus.PENDING, TicketStatus.RESOLVED)).toBe(true);
    expect(canTransitionTicket(TicketStatus.RESOLVED, TicketStatus.CLOSED)).toBe(true);
  });

  it('forbids jumping from CLOSED back to OPEN (reopen is a separate API)', () => {
    expect(canTransitionTicket(TicketStatus.CLOSED, TicketStatus.OPEN)).toBe(false);
  });

  it('allows ESCALATED → RESOLVED (saved by a senior agent)', () => {
    expect(canTransitionTicket(TicketStatus.ESCALATED, TicketStatus.RESOLVED)).toBe(true);
  });

  it('treats unknown source / target as forbidden', () => {
    // @ts-expect-error — deliberately invalid status to verify defensive path.
    expect(canTransitionTicket('UNKNOWN' as TicketStatus, TicketStatus.OPEN)).toBe(false);
  });
});
