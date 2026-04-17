import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().length(64),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@example.com'),

  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  BINANCE_BASE_URL: z.string().default('https://api.binance.com'),

  INDODAX_API_KEY: z.string().optional(),
  INDODAX_API_SECRET: z.string().optional(),
  INDODAX_BASE_URL: z.string().default('https://indodax.com/tapi'),

  TOKOCRYPTO_API_KEY: z.string().optional(),
  TOKOCRYPTO_API_SECRET: z.string().optional(),
  TOKOCRYPTO_BASE_URL: z.string().default('https://www.tokocrypto.com'),

  OKX_API_KEY: z.string().optional(),
  OKX_API_SECRET: z.string().optional(),
  OKX_PASSPHRASE: z.string().optional(),
  OKX_BASE_URL: z.string().default('https://www.okx.com'),

  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  MIDTRANS_NOTIFICATION_KEY: z.string().optional(),

  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_CALLBACK_TOKEN: z.string().optional(),
  XENDIT_IS_PRODUCTION: z.coerce.boolean().default(false),

  FLIP_SECRET_KEY: z.string().optional(),
  FLIP_VALIDATION_TOKEN: z.string().optional(),
  FLIP_BASE_URL: z.string().default('https://sandbox.flip.id/api/v2'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  CASHOUT_JOB_CONCURRENCY: z.coerce.number().default(5),
  CASHOUT_JOB_MAX_RETRIES: z.coerce.number().default(3),
  CASHOUT_QUOTE_TTL_SECONDS: z.coerce.number().default(300),

  DEFAULT_CASHOUT_FEE_PERCENT: z.coerce.number().default(0.015),
  MIN_CASHOUT_AMOUNT_IDR: z.coerce.number().default(50000),
  MAX_CASHOUT_AMOUNT_IDR: z.coerce.number().default(50000000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
