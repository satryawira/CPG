import Decimal from 'decimal.js';
import { prisma } from '@/config/database';
import { redis, REDIS_KEYS } from '@/config/redis';
import { exchangeFactory } from '@/integrations/exchanges/exchange.factory';
import { lockBalance } from '@/modules/wallet/wallet.service';
import { AppError, HttpStatus } from '@/utils/AppError';
import { cashoutQueue } from '@/jobs/queues/cashout.queue';
import { getPaginationParams, buildPaginationMeta, paginatedResponse } from '@/utils/pagination.util';
import { env } from '@/config/env';
import type { GetQuoteDto, SubmitCashoutDto } from './cashout.dto';
import type { ExchangeProvider, NetworkType, TransactionStatus, WalletCurrency } from '@prisma/client';

const QUOTE_TTL = Number(process.env.CASHOUT_QUOTE_TTL_SECONDS) || 300;

export interface CashoutQuote {
  currency: string;
  amount: string;
  quotes: Array<{
    provider: string;
    pair: string;
    rate: string;
    idrGross: string;
    exchangeFee: string;
    platformFee: string;
    idrNet: string;
  }>;
  bestProvider: string;
  expiresAt: string;
}

export async function getQuote(dto: GetQuoteDto): Promise<CashoutQuote> {
  const amount = new Decimal(dto.amount);

  if (amount.lte(0)) throw new AppError('Amount must be positive', HttpStatus.BAD_REQUEST);

  const quotes = await exchangeFactory.getBestQuotes(dto.currency, amount);

  if (quotes.length === 0) throw new AppError('No exchange rates available', HttpStatus.SERVICE_UNAVAILABLE);

  // Get platform fee config
  const feeConfig = await prisma.feeConfig.findUnique({
    where: { currency_type: { currency: dto.currency as WalletCurrency, type: 'CASHOUT' } },
  });

  const result = quotes.map((q) => {
    let platformFee = q.idrGross.mul(env.DEFAULT_CASHOUT_FEE_PERCENT);
    if (feeConfig && feeConfig.isActive) {
      const { calculateFee } = require('@/utils/fee.util');
      platformFee = calculateFee(q.idrGross, feeConfig);
    }

    const idrNet = q.idrNet.sub(platformFee);
    const idrNetMinusExchangeFee = idrNet;

    return {
      provider: q.provider,
      pair: q.pair,
      rate: q.rate.toFixed(2),
      idrGross: q.idrGross.toFixed(2),
      exchangeFee: q.exchangeFee.toFixed(2),
      platformFee: platformFee.toFixed(2),
      idrNet: idrNetMinusExchangeFee.toFixed(2),
    };
  });

  const expiresAt = new Date(Date.now() + QUOTE_TTL * 1000).toISOString();

  return {
    currency: dto.currency,
    amount: dto.amount,
    quotes: result,
    bestProvider: result[0]?.provider || '',
    expiresAt,
  };
}

export async function submitCashout(userId: string, dto: SubmitCashoutDto) {
  const amount = new Decimal(dto.amount);

  // Validate min/max
  const quotes = await exchangeFactory.getBestQuotes(dto.currency, amount);
  if (quotes.length === 0) throw new AppError('No exchange rates available', HttpStatus.SERVICE_UNAVAILABLE);

  const bestQuote = quotes[0];
  const estimatedIdr = bestQuote.idrNet.toNumber();

  if (estimatedIdr < env.MIN_CASHOUT_AMOUNT_IDR) {
    throw new AppError(`Minimum cashout is IDR ${env.MIN_CASHOUT_AMOUNT_IDR.toLocaleString('id-ID')}`, HttpStatus.BAD_REQUEST);
  }
  if (estimatedIdr > env.MAX_CASHOUT_AMOUNT_IDR) {
    throw new AppError(`Maximum cashout is IDR ${env.MAX_CASHOUT_AMOUNT_IDR.toLocaleString('id-ID')}`, HttpStatus.BAD_REQUEST);
  }

  // Validate bank account belongs to user
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: dto.bankAccountId, userId },
  });
  if (!bankAccount) throw new AppError('Bank account not found', HttpStatus.NOT_FOUND);

  // Find wallet with sufficient balance
  const wallet = await prisma.wallet.findFirst({
    where: { userId, currency: dto.currency as WalletCurrency, network: dto.network as NetworkType, isActive: true },
  });
  if (!wallet) throw new AppError(`No ${dto.currency} wallet found`, HttpStatus.NOT_FOUND);

  const availableBalance = new Decimal(wallet.balance.toString());
  if (availableBalance.lt(amount)) {
    throw new AppError('Insufficient balance', HttpStatus.BAD_REQUEST, 'INSUFFICIENT_BALANCE');
  }

  const selectedProvider: ExchangeProvider = (dto.exchangeProvider as ExchangeProvider) || (bestQuote.provider as ExchangeProvider);

  // Lock balance
  await lockBalance(wallet.id, amount);

  // Create cashout request
  const expiredAt = new Date(Date.now() + QUOTE_TTL * 1000);
  const cashout = await prisma.cashoutRequest.create({
    data: {
      userId,
      bankAccountId: dto.bankAccountId,
      cryptoCurrency: dto.currency as WalletCurrency,
      cryptoAmount: amount.toFixed(18),
      cryptoNetwork: dto.network as NetworkType,
      exchangeProvider: selectedProvider,
      expiredAt,
    },
  });

  // Push to queue
  await cashoutQueue.add('process-cashout', { cashoutRequestId: cashout.id }, { jobId: cashout.id });

  return cashout;
}

export async function getCashouts(userId: string, query: { page?: number; limit?: number; status?: TransactionStatus }) {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, cashouts] = await Promise.all([
    prisma.cashoutRequest.count({ where }),
    prisma.cashoutRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } } },
    }),
  ]);

  return paginatedResponse(cashouts, buildPaginationMeta(total, page, limit));
}

export async function getCashoutById(userId: string, cashoutId: string) {
  const cashout = await prisma.cashoutRequest.findFirst({
    where: { id: cashoutId, userId },
    include: { bankAccount: true, transaction: true },
  });
  if (!cashout) throw new AppError('Cashout request not found', HttpStatus.NOT_FOUND);
  return cashout;
}

export async function cancelCashout(userId: string, cashoutId: string) {
  const cashout = await prisma.cashoutRequest.findFirst({ where: { id: cashoutId, userId } });
  if (!cashout) throw new AppError('Cashout request not found', HttpStatus.NOT_FOUND);
  if (cashout.status !== 'PENDING') throw new AppError('Only PENDING cashouts can be cancelled', HttpStatus.BAD_REQUEST);

  // Find wallet to unlock balance
  const wallet = await prisma.wallet.findFirst({
    where: { userId, currency: cashout.cryptoCurrency, isActive: true },
  });

  if (wallet) {
    const { unlockBalance } = await import('@/modules/wallet/wallet.service');
    await unlockBalance(wallet.id, new Decimal(cashout.cryptoAmount.toString()));
  }

  // Remove from queue
  const job = await cashoutQueue.getJob(cashoutId);
  if (job) await job.remove();

  return prisma.cashoutRequest.update({
    where: { id: cashoutId },
    data: { status: 'CANCELLED' },
  });
}
