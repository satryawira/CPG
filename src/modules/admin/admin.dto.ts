import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']).optional(),
    search: z.string().optional(),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
    reason: z.string().optional(),
  }),
});

export const reviewKycSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    notes: z.string().optional(),
  }),
});

export const listKycSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    status: z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  }),
});

export const createFeeConfigSchema = z.object({
  body: z.object({
    currency: z.enum(['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'IDR']),
    type: z.string().min(1),
    feePercent: z.number().min(0).max(1),
    feeFlat: z.number().min(0).optional().default(0),
    minFee: z.number().min(0).optional().default(0),
    maxFee: z.number().min(0).optional(),
  }),
});

export const updateFeeConfigSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    feePercent: z.number().min(0).max(1).optional(),
    feeFlat: z.number().min(0).optional(),
    minFee: z.number().min(0).optional(),
    maxFee: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const listCashoutsAdminSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
    userId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});
