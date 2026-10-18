import { LocationSigner } from '../location-signer.service';
import { pingSignatureOk } from '../tracking.service';

const signer = new LocationSigner();
const ping = { deviceId: 'dev-1', latitude: 12.9716, longitude: 77.5946, recordedAt: '2026-10-18T09:00:00.000Z' };
const tech = { id: 'tech_1', locationSignKey: 'sign-key' };
const signed = signer.sign('sign-key', LocationSigner.buildPayload({ technicianId: 'tech_1', ...ping }));

describe('pingSignatureOk', () => {
  it('accepts unsigned pings while no sign key is provisioned', () => {
    expect(pingSignatureOk(signer, { ...tech, locationSignKey: null }, { ...ping, signature: undefined })).toBe(true);
  });

  it('accepts a correctly signed ping', () => {
    expect(pingSignatureOk(signer, tech, { ...ping, signature: signed })).toBe(true);
  });

  it('rejects an unsigned ping once a key exists', () => {
    expect(pingSignatureOk(signer, tech, { ...ping, signature: undefined })).toBe(false);
    expect(pingSignatureOk(signer, tech, { ...ping, deviceId: undefined, signature: signed })).toBe(false);
  });

  it('rejects a ping whose coordinates were changed after signing', () => {
    expect(pingSignatureOk(signer, tech, { ...ping, latitude: 13.0, signature: signed })).toBe(false);
  });
});
