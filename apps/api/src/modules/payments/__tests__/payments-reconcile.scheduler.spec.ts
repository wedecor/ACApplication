import { PaymentsReconcileScheduler } from '../payments-reconcile.scheduler';

function build(env: Partial<{ PAYMENTS_RECONCILE_ENABLED: boolean }> = {}) {
  const payments = { reconcileStale: jest.fn().mockResolvedValue({ scanned: 0 }) };
  const scheduler = new PaymentsReconcileScheduler(payments as never, {
    PAYMENTS_RECONCILE_ENABLED: true,
    PAYMENTS_RECONCILE_STALE_MINUTES: 20,
    PAYMENTS_RECONCILE_BATCH_SIZE: 50,
    ...env,
  });
  return { scheduler, payments };
}

describe('PaymentsReconcileScheduler', () => {
  afterEach(() => {
    delete process.env.FINANCE_SCHEDULER_DISABLED;
  });

  it('passes the configured threshold + batch size to reconcileStale', async () => {
    const { scheduler, payments } = build();
    await scheduler.reconcileStalePayments();
    expect(payments.reconcileStale).toHaveBeenCalledWith({ staleAfterMinutes: 20, batchSize: 50 });
  });

  it('is a no-op when PAYMENTS_RECONCILE_ENABLED=false', async () => {
    const { scheduler, payments } = build({ PAYMENTS_RECONCILE_ENABLED: false });
    await expect(scheduler.reconcileStalePayments()).resolves.toBeNull();
    expect(payments.reconcileStale).not.toHaveBeenCalled();
  });

  it('honours the shared FINANCE_SCHEDULER_DISABLED kill-switch', async () => {
    process.env.FINANCE_SCHEDULER_DISABLED = '1';
    const { scheduler, payments } = build();
    await scheduler.reconcileStalePayments();
    expect(payments.reconcileStale).not.toHaveBeenCalled();
  });

  it('skips overlapping ticks in the same process', async () => {
    const { scheduler, payments } = build();
    let release!: () => void;
    payments.reconcileStale.mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve({ scanned: 1 });
      }),
    );
    const first = scheduler.reconcileStalePayments();
    await expect(scheduler.reconcileStalePayments()).resolves.toBeNull();
    release();
    await expect(first).resolves.toEqual({ scanned: 1 });
    expect(payments.reconcileStale).toHaveBeenCalledTimes(1);
    // Flag is cleared after completion.
    await scheduler.reconcileStalePayments();
    expect(payments.reconcileStale).toHaveBeenCalledTimes(2);
  });

  it('swallows errors so the cron keeps running, and clears the re-entrancy flag', async () => {
    const { scheduler, payments } = build();
    payments.reconcileStale.mockRejectedValueOnce(new Error('db down'));
    await expect(scheduler.reconcileStalePayments()).resolves.toBeNull();
    await scheduler.reconcileStalePayments();
    expect(payments.reconcileStale).toHaveBeenCalledTimes(2);
  });
});
