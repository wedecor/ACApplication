import { BOOKING_STATUS_LABEL, humanizeStatus } from '../status';

describe('status copy', () => {
  it('sentence-cases raw enums, replacing every underscore', () => {
    expect(humanizeStatus('WAITING_ON_CUSTOMER')).toBe('Waiting on customer');
    expect(humanizeStatus('PAID')).toBe('Paid');
    expect(humanizeStatus(null)).toBe('');
  });

  it('has curated copy for every booking status', () => {
    expect(BOOKING_STATUS_LABEL.AWAITING_PARTS).toBe('Awaiting parts');
    expect(BOOKING_STATUS_LABEL.EN_ROUTE).toBe('On the way');
  });
});
