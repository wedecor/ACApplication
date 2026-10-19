import { setSingleInstanceStore, SingleInstance } from '../single-instance';

class Job {
  runs = 0;

  @SingleInstance(1_000)
  async tick(): Promise<void> {
    this.runs += 1;
  }
}

function fakeStore() {
  const held = new Set<string>();
  return {
    set: jest.fn(async (key: string) => {
      if (held.has(key)) return null;
      held.add(key);
      return 'OK' as const;
    }),
  };
}

describe('SingleInstance', () => {
  afterEach(() => setSingleInstanceStore(null));

  it('runs each occurrence once across instances sharing Redis', async () => {
    setSingleInstanceStore(fakeStore());
    const nodeA = new Job();
    const nodeB = new Job();
    await Promise.all([nodeA.tick(), nodeB.tick()]);
    expect(nodeA.runs + nodeB.runs).toBe(1);
  });

  it('uses a per-job key with the hold time', async () => {
    const s = fakeStore();
    setSingleInstanceStore(s);
    await new Job().tick();
    expect(s.set).toHaveBeenCalledWith('cron:lock:Job.tick', expect.any(String), 'PX', 1_000, 'NX');
  });

  it('still runs when Redis is unavailable', async () => {
    setSingleInstanceStore({ set: jest.fn().mockRejectedValue(new Error('down')) });
    const job = new Job();
    await job.tick();
    expect(job.runs).toBe(1);
  });
});
