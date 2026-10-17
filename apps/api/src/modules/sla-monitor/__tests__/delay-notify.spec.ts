import { DELAY_RENOTIFY_STEP_MIN, shouldNotifyDelay } from '../sla-monitor.service';

describe('shouldNotifyDelay', () => {
  it('notifies the first time a booking is projected late', () => {
    expect(shouldNotifyDelay(undefined, 5)).toBe(true);
  });

  it('stays quiet while the delay is roughly unchanged (cron runs every minute)', () => {
    expect(shouldNotifyDelay(12, 12)).toBe(false);
    expect(shouldNotifyDelay(12, 12 + DELAY_RENOTIFY_STEP_MIN - 1)).toBe(false);
  });

  it('re-notifies once the delay grows by a full step', () => {
    expect(shouldNotifyDelay(12, 12 + DELAY_RENOTIFY_STEP_MIN)).toBe(true);
  });

  it('never re-notifies when the technician is catching up', () => {
    expect(shouldNotifyDelay(30, 10)).toBe(false);
  });
});
