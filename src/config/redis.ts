import IORedis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let _redis: IORedis | null = null;

function createRedisClient(): IORedis {
  const client = new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 100, 3000);
    },
  });
  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { error: err.message }));
  return client;
}

export function getRedis(): IORedis {
  if (!_redis) {
    _redis = createRedisClient();
  }
  return _redis;
}

export const redis = new Proxy({} as IORedis, {
  get(_target, prop) {
    return (getRedis() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const REDIS_KEYS = {
  cashoutQuote: (userId: string) => `cashout:quote:${userId}`,
  exchangeRate: (provider: string, pair: string) => `rate:${provider}:${pair}`,
  emailOtp: (email: string) => `otp:email:${email}`,
  refreshTokenBlacklist: (jti: string) => `blacklist:token:${jti}`,
};
