import { secureStore } from '../secure-store';

describe('secureStore', () => {
  it('round-trips a value', async () => {
    await secureStore.setItem('test.key', 'value');
    await expect(secureStore.getItem('test.key')).resolves.toBe('value');
    await secureStore.removeItem('test.key');
    await expect(secureStore.getItem('test.key')).resolves.toBeNull();
  });
});
