import { z } from 'zod';

export const getQuoteSchema = z.object({
  body: z.object({
    currency: z.enum(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']),
    amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a valid number'),
    network: z.enum(['ERC20', 'TRC20', 'BEP20', 'NATIVE']).optional(),
  }),
});

export const submitCashoutSchema = z.object({
  body: z.object({
    currency: z.enum(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']),
    amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a valid number'),
    network: z.enum(['ERC20', 'TRC20', 'BEP20', 'NATIVE']),
    bankAccountId: z.string().uuid(),
    exchangeProvider: z.enum(['INDODAX', 'TOKOCRYPTO', 'BINANCE', 'OKX']).optional(),
  }),
});

export const listCashoutsSchema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  }),
});

export type GetQuoteDto = z.infer<typeof getQuoteSchema>['body'];
export type SubmitCashoutDto = z.infer<typeof submitCashoutSchema>['body'];
