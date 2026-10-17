import { AuthService } from '../auth.service';

describe('AuthService.revokeSessions', () => {
  function build() {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const svc = new AuthService({} as never, {} as never, { client: { session: { updateMany } } } as never, {} as never);
    return { svc, updateMany };
  }
  it('revokes every open session of the user (logout-all)', async () => {
    const { svc, updateMany } = build();
    expect(await svc.revokeSessions('u1')).toBe(3);
    expect(updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', revokedAt: null });
  });
  it('revokes only the current session on logout', async () => {
    const { svc, updateMany } = build();
    await svc.revokeSessions('u1', 's1');
    expect(updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', revokedAt: null, id: 's1' });
  });
});
