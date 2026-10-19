import { otp } from '@ac/auth';
import { ActivityType, BookingStatus, DomainEventName } from '@ac/types';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { actor, buildService, makeBooking, publishedEventNames } from './bookings.test-helpers';

const S = BookingStatus;
const TEST_CODE = '123456';
const TEN_MIN = 10 * 60 * 1000;

function issuedBooking(overrides: Parameters<typeof makeBooking>[0] = {}) {
  return makeBooking({
    status: S.TECHNICIAN_EN_ROUTE,
    technicianId: 'tech_1',
    otpCodeHash: otp.hash(TEST_CODE),
    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    otpAttempts: 0,
    otpVerifiedAt: null,
    ...overrides,
  });
}

describe('BookingsService.sendArrivalOtp', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('throws NotFound for an unknown booking', async () => {
    const { svc } = buildService(null);
    await expect(svc.sendArrivalOtp(actor, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(Object.values(BookingStatus).filter((s) => s !== S.TECHNICIAN_EN_ROUTE))(
    'refuses to issue an OTP while %s',
    async (status) => {
      const { svc, repo, events } = buildService(makeBooking({ status }));
      await expect(svc.sendArrivalOtp(actor, 'book_1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    },
  );

  it('stores only a hash, resets attempts/verification and sets a 10 minute expiry', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-16T08:00:00.000Z') });
    jest.spyOn(otp, 'generate').mockReturnValue(TEST_CODE);
    const { svc, repo, tx } = buildService(makeBooking({ status: S.TECHNICIAN_EN_ROUTE }));

    await svc.sendArrivalOtp(actor, 'book_1');

    expect(repo.update).toHaveBeenCalledTimes(1);
    const [id, data, passedTx] = repo.update.mock.calls[0]!;
    expect(id).toBe('book_1');
    expect(passedTx).toBe(tx);
    expect(data).toEqual(
      expect.objectContaining({
        otpCodeHash: otp.hash(TEST_CODE),
        otpAttempts: 0,
        otpVerifiedAt: null,
        updatedBy: 'user_1',
      }),
    );
    expect((data as { otpExpiresAt: Date }).otpExpiresAt.getTime()).toBe(Date.now() + TEN_MIN);
    // Raw code is never persisted.
    expect(JSON.stringify(data)).not.toContain(`"${TEST_CODE}"`);
  });

  it('generates a 6-digit code', async () => {
    const spy = jest.spyOn(otp, 'generate');
    const { svc } = buildService(makeBooking({ status: S.TECHNICIAN_EN_ROUTE }));
    await svc.sendArrivalOtp(actor, 'book_1');
    expect(spy).toHaveBeenCalledWith({ length: 6 });
  });

  it('records OTP_SENT activity and publishes BookingOtpSent with expiry', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-16T08:00:00.000Z') });
    const { svc, activity, events, tx } = buildService(
      makeBooking({ status: S.TECHNICIAN_EN_ROUTE }),
    );
    await svc.sendArrivalOtp(actor, 'book_1');
    expect(activity.recordBookingActivity).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({ type: ActivityType.OTP_SENT, actorUserId: 'user_1' }),
      tx,
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingOtpSent, {
      bookingId: 'book_1',
      expiresAt: '2026-10-16T08:10:00.000Z',
    });
  });

  it('returns the plaintext code only in development', async () => {
    jest.spyOn(otp, 'generate').mockReturnValue(TEST_CODE);
    process.env.NODE_ENV = 'development';
    const { svc } = buildService(makeBooking({ status: S.TECHNICIAN_EN_ROUTE }));
    await expect(svc.sendArrivalOtp(actor, 'book_1')).resolves.toEqual({ devCode: TEST_CODE });
  });

  it.each(['test', 'production'])('does not leak the code when NODE_ENV=%s', async (env) => {
    jest.spyOn(otp, 'generate').mockReturnValue(TEST_CODE);
    process.env.NODE_ENV = env;
    const { svc } = buildService(makeBooking({ status: S.TECHNICIAN_EN_ROUTE }));
    await expect(svc.sendArrivalOtp(actor, 'book_1')).resolves.toEqual({ ok: true });
  });
});

describe('BookingsService.verifyArrivalOtp', () => {
  afterEach(() => jest.useRealTimers());

  it('throws NotFound for an unknown booking', async () => {
    const { svc } = buildService(null);
    await expect(
      svc.verifyArrivalOtp(actor, 'nope', { code: TEST_CODE }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when no OTP was issued (no hash)', async () => {
    const { svc, repo } = buildService(issuedBooking({ otpCodeHash: null }));
    const p = svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE });
    await expect(p).rejects.toBeInstanceOf(BadRequestException);
    await expect(p).rejects.toThrow('No OTP issued for this booking');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects when no OTP was issued (no expiry)', async () => {
    const { svc } = buildService(issuedBooking({ otpExpiresAt: null }));
    await expect(
      svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second verification with Conflict', async () => {
    const { svc, repo } = buildService(issuedBooking({ otpVerifiedAt: new Date() }));
    await expect(
      svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects an expired OTP without counting an attempt', async () => {
    const { svc, repo } = buildService(
      issuedBooking({ otpExpiresAt: new Date(Date.now() - 1000) }),
    );
    const p = svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE });
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(p).rejects.toThrow(/expired/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts an OTP exactly at its expiry instant (strict < comparison)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-16T08:00:00.000Z') });
    const { svc } = buildService(issuedBooking({ otpExpiresAt: new Date(Date.now()) }));
    await expect(
      svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE }),
    ).resolves.toEqual(expect.objectContaining({ status: S.IN_PROGRESS }));
  });

  it('expires 10 minutes after issue (end-to-end with sendArrivalOtp)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-16T08:00:00.000Z') });
    const generate = jest.spyOn(otp, 'generate').mockReturnValue(TEST_CODE);
    const sender = buildService(makeBooking({ status: S.TECHNICIAN_EN_ROUTE }));
    await sender.svc.sendArrivalOtp(actor, 'book_1');
    const written = sender.repo.update.mock.calls[0]![1] as {
      otpCodeHash: string;
      otpExpiresAt: Date;
    };
    generate.mockRestore();

    jest.setSystemTime(new Date('2026-10-16T08:10:00.001Z'));
    const verifier = buildService(
      issuedBooking({ otpCodeHash: written.otpCodeHash, otpExpiresAt: written.otpExpiresAt }),
    );
    await expect(
      verifier.svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE }),
    ).rejects.toThrow(/expired/);
  });

  it('rejects a wrong code, increments attempts outside a transaction, and does not start work', async () => {
    const { svc, repo, prisma, events, activity } = buildService(issuedBooking({ otpAttempts: 2 }));
    const p = svc.verifyArrivalOtp(actor, 'book_1', { code: '000000' });
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(p).rejects.toThrow('Invalid OTP');
    expect(repo.update).toHaveBeenCalledWith('book_1', {
      otpAttempts: { increment: 1 },
      updatedBy: 'user_1',
    });
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
    expect(activity.recordBookingActivity).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('allows a try while attempts are below the max (4 of 5 used)', async () => {
    const { svc } = buildService(issuedBooking({ otpAttempts: 4 }));
    await expect(
      svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE }),
    ).resolves.toEqual(expect.objectContaining({ status: S.IN_PROGRESS }));
  });

  it.each([5, 6, 50])('locks out once attempts >= 5 (attempts=%i), even with the right code', async (n) => {
    const { svc, repo } = buildService(issuedBooking({ otpAttempts: n }));
    const p = svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE });
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(p).rejects.toThrow('Too many failed attempts');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('checks expiry before the attempt limit', async () => {
    const { svc } = buildService(
      issuedBooking({ otpAttempts: 5, otpExpiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(
      svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE }),
    ).rejects.toThrow(/expired/);
  });

  it('on the correct code: marks verified, moves to IN_PROGRESS, stamps startedAt', async () => {
    const { svc, repo, tx } = buildService(issuedBooking());
    const result = await svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE });
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({
        otpVerifiedAt: expect.any(Date),
        status: S.IN_PROGRESS,
        startedAt: expect.any(Date),
        updatedBy: 'user_1',
      }),
      tx,
    );
    expect(result).toEqual(expect.objectContaining({ status: S.IN_PROGRESS }));
  });

  it('on the correct code: records OTP_VERIFIED and publishes verified + status-changed events', async () => {
    const { svc, activity, events, tx } = buildService(issuedBooking());
    await svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE });
    expect(activity.recordBookingActivity).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({
        type: ActivityType.OTP_VERIFIED,
        fromStatus: S.TECHNICIAN_EN_ROUTE,
        toStatus: S.IN_PROGRESS,
      }),
      tx,
    );
    expect(publishedEventNames(events)).toEqual([
      DomainEventName.BookingOtpVerified,
      DomainEventName.BookingStatusChanged,
    ]);
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingStatusChanged, {
      bookingId: 'book_1',
      from: S.TECHNICIAN_EN_ROUTE,
      to: S.IN_PROGRESS,
    });
  });

  it('does not accept the hash itself as a code', async () => {
    const booking = issuedBooking();
    const { svc } = buildService(booking);
    await expect(
      svc.verifyArrivalOtp(actor, 'book_1', { code: booking.otpCodeHash! }),
    ).rejects.toThrow('Invalid OTP');
  });

  // Documents CURRENT behaviour (see report): verifyArrivalOtp does not check
  // the booking status, so a still-valid OTP on a CANCELLED booking flips it
  // back to IN_PROGRESS, bypassing the state machine.
  it('currently does NOT guard on booking status (CANCELLED -> IN_PROGRESS via OTP)', async () => {
    const { svc, repo } = buildService(issuedBooking({ status: S.CANCELLED }));
    await svc.verifyArrivalOtp(actor, 'book_1', { code: TEST_CODE });
    expect(repo.update.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ status: S.IN_PROGRESS }),
    );
  });
});
