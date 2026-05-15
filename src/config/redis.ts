import IORedis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new IORedis(env.REDIS_URL, {
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 100, 3000);
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

export const REDIS_KEYS = {
  cashoutQuote: (userId: string) => `cashout:quote:${userId}`,
  exchangeRate: (provider: string, pair: string) => `rate:${provider}:${pair}`,
  emailOtp: (email: string) => `otp:email:${email}`,
  refreshTokenBlacklist: (jti: string) => `blacklist:token:${jti}`,
};
