import { z } from 'zod';

export const createWalletSchema = z.object({
  body: z.object({
    currency: z.enum(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']),
    network: z.enum(['ERC20', 'TRC20', 'BEP20', 'NATIVE']).optional(),
  }),
});

export const addBankAccountSchema = z.object({
  body: z.object({
    bankCode: z.string().min(2).max(20).toUpperCase(),
    bankName: z.string().min(2).max(100),
    accountNumber: z.string().min(8).max(20),
    accountName: z.string().min(2).max(100),
    isDefault: z.boolean().optional().default(false),
  }),
});

export const listTransactionsSchema = z.object({
  params: z.object({ walletId: z.string().uuid() }),
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'CASHOUT', 'FEE', 'INTERNAL']).optional(),
  }),
});

export type CreateWalletDto = z.infer<typeof createWalletSchema>['body'];
export type AddBankAccountDto = z.infer<typeof addBankAccountSchema>['body'];
