import { LocationSigner } from '../location-signer.service';

describe('LocationSigner', () => {
  const signer = new LocationSigner();
  const secret = 'tech-secret-key';

  it('produces deterministic signatures', () => {
    const payload = LocationSigner.buildPayload({
      technicianId: 'tech_1',
      deviceId: 'dev_a',
      latitude: 12.9716,
      longitude: 77.5946,
      recordedAt: '2025-01-01T00:00:00.000Z',
    });
    const sig1 = signer.sign(secret, payload);
    const sig2 = signer.sign(secret, payload);
    expect(sig1).toEqual(sig2);
    expect(signer.verify(secret, payload, sig1)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const payload = LocationSigner.buildPayload({
      technicianId: 'tech_1',
      deviceId: 'dev_a',
      latitude: 12.9716,
      longitude: 77.5946,
      recordedAt: '2025-01-01T00:00:00.000Z',
    });
    const sig = signer.sign(secret, payload);
    const tampered = payload.replace('12.971600', '99.999999');
    expect(signer.verify(secret, tampered, sig)).toBe(false);
  });

  it('rejects a different secret', () => {
    const payload = LocationSigner.buildPayload({
      technicianId: 'tech_1',
      deviceId: 'dev_a',
      latitude: 12.9716,
      longitude: 77.5946,
      recordedAt: '2025-01-01T00:00:00.000Z',
    });
    const sig = signer.sign(secret, payload);
    expect(signer.verify('wrong', payload, sig)).toBe(false);
  });

  it('rejects timestamps drifted beyond 5 minutes', () => {
    expect(signer.isFreshTimestamp(new Date().toISOString())).toBe(true);
    expect(signer.isFreshTimestamp(new Date(Date.now() - 10 * 60_000).toISOString())).toBe(false);
    expect(signer.isFreshTimestamp('not-a-date')).toBe(false);
  });
});
