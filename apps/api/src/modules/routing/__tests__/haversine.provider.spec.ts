import { HaversineMapProvider } from '../providers/haversine.provider';

describe('HaversineMapProvider', () => {
  const p = new HaversineMapProvider();

  it('returns roughly the great-circle distance between two known points', async () => {
    // MG Road, Bengaluru → Whitefield ≈ 18 km on most routing apps.
    const origin = { latitude: 12.9756, longitude: 77.6062 };
    const dest = { latitude: 12.9698, longitude: 77.7499 };
    const est = await p.estimate(origin, dest);
    expect(est.provider).toBe('haversine');
    // Haversine is straight-line so it'll undershoot vs. Google driving.
    expect(est.distanceM).toBeGreaterThan(10_000);
    expect(est.distanceM).toBeLessThan(20_000);
    expect(est.durationS).toBeGreaterThan(60);
    expect(est.trafficDurationS).toBeNull();
  });

  it('floors durations at 60 seconds for adjacent points', async () => {
    const a = { latitude: 12.9756, longitude: 77.6062 };
    const b = { latitude: 12.9757, longitude: 77.6063 };
    const est = await p.estimate(a, b);
    expect(est.durationS).toBeGreaterThanOrEqual(60);
  });
});
