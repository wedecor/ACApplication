import { HealthCheckError } from '@nestjs/terminus';

import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthServiceMock: {
    check: jest.Mock;
  };
  let prismaHealthMock: {
    pingCheck: jest.Mock;
  };
  let prismaMock: {
    client: Record<string, unknown>;
  };
  let redisMock: {
    default: {
      ping: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.useFakeTimers();
    healthServiceMock = {
      check: jest.fn(async (indicators: (() => Promise<unknown>)[]) => {
        const details = await Promise.all(indicators.map((fn) => fn()));
        return {
          status: 'ok',
          info: Object.assign({}, ...details),
          error: {},
          details: Object.assign({}, ...details),
        };
      }),
    };
    prismaHealthMock = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    prismaMock = {
      client: { __prisma: true },
    };
    redisMock = {
      default: {
        ping: jest.fn().mockResolvedValue('PONG'),
      },
    };

    controller = new HealthController(
      healthServiceMock as never,
      prismaHealthMock as never,
      prismaMock as never,
      redisMock as never,
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('liveness', () => {
    it('returns { status: "ok" }', () => {
      expect(controller.liveness()).toEqual({ status: 'ok' });
    });
  });

  describe('check', () => {
    it('calls health.check with database and redis indicators, returning healthy result on success', async () => {
      const result = await controller.check();

      expect(healthServiceMock.check).toHaveBeenCalledTimes(1);
      expect(prismaHealthMock.pingCheck).toHaveBeenCalledWith('database', prismaMock.client);
      expect(redisMock.default.ping).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      });
    });

    it('throws HealthCheckError when redis ping fails or times out', async () => {
      redisMock.default.ping.mockRejectedValue(new Error('Connection refused'));

      await expect(controller.check()).rejects.toThrow(HealthCheckError);
      await expect(controller.check()).rejects.toMatchObject({
        message: 'Redis check failed',
        causes: {
          redis: {
            status: 'down',
            message: 'Connection refused',
          },
        },
      });
    });

    it('throws HealthCheckError when redis replies with unexpected string', async () => {
      redisMock.default.ping.mockResolvedValue('ERROR');

      await expect(controller.check()).rejects.toThrow(HealthCheckError);
      await expect(controller.check()).rejects.toMatchObject({
        message: 'Redis check failed',
        causes: {
          redis: {
            status: 'down',
            message: 'unexpected reply ERROR',
          },
        },
      });
    });

    it('propagates error when prisma pingCheck fails', async () => {
      prismaHealthMock.pingCheck.mockRejectedValue(new Error('Postgres unreachable'));

      await expect(controller.check()).rejects.toThrow('Postgres unreachable');
    });
  });
});
