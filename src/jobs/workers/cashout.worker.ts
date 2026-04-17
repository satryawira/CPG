import { Worker, Job } from 'bullmq';
import Decimal from 'decimal.js';
import { redis } from '@/config/redis';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { exchangeFactory } from '@/integrations/exchanges/exchange.factory';
import { gatewayFactory } from '@/integrations/payment-gateways/gateway.factory';
import { deductLockedBalance, unlockBalance } from '@/modules/wallet/wallet.service';
import type { CashoutJobData } from '@/jobs/queues/cashout.queue';
import type { ExchangeProvider } from '@prisma/client';

const ORDER_POLL_INTERVAL_MS = 2000;
const ORDER_POLL_MAX_ATTEMPTS = 30; // 60 seconds max

async function pollUntilFilled(provider: ExchangeProvider, orderId: string, pair: string) {
  const exchange = exchangeFactory.getExchange(provider);

  for (let i = 0; i < ORDER_POLL_MAX_ATTEMPTS; i++) {
    const order = await exchange.getOrderById(orderId, pair);
    if (order.status === 'FILLED') return order;
    if (order.status === 'CANCELLED') throw new Error(`Order ${orderId} was cancelled`);
    await new Promise((resolve) => setTimeout(resolve, ORDER_POLL_INTERVAL_MS));
  }

  throw new Error(`Order ${orderId} not filled after ${ORDER_POLL_MAX_ATTEMPTS * ORDER_POLL_INTERVAL_MS / 1000}s`);
}

async function processCashout(job: Job<CashoutJobData>): Promise<void> {
  const { cashoutRequestId } = job.data;

  const cashout = await prisma.cashoutRequest.findUnique({
    where: { id: cashoutRequestId },
    include: { bankAccount: true, user: true },
  });

  if (!cashout) throw new Error(`CashoutRequest ${cashoutRequestId} not found`);
  if (cashout.status !== 'PENDING') {
    logger.info(`Cashout ${cashoutRequestId} is not PENDING (${cashout.status}), skipping`);
    return;
  }

  // 1. Update status → PROCESSING
  await prisma.cashoutRequest.update({
    where: { id: cashoutRequestId },
    data: { status: 'PROCESSING' },
  });

  let exchangeProvider: ExchangeProvider = cashout.exchangeProvider || 'INDODAX';
  const pair = exchangeFactory.getPairForExchange(exchangeProvider, cashout.cryptoCurrency) || '';

  try {
    // 2. Execute market sell on exchange
    const exchange = exchangeFactory.getExchange(exchangeProvider);
    const cryptoAmount = new Decimal(cashout.cryptoAmount.toString());

    logger.info(`Executing MARKET SELL on ${exchangeProvider}`, { cashoutRequestId, pair, cryptoAmount });

    const order = await exchange.createMarketSellOrder({ pair, quantity: cryptoAmount });

    // 3. Poll until filled
    const filledOrder = order.status === 'FILLED' ? order : await pollUntilFilled(exchangeProvider, order.orderId, pair);

    const idrGross = filledOrder.idrTotal;
    const exchangeFee = filledOrder.fee;

    // 4. Get platform fee config
    const feeConfig = await prisma.feeConfig.findUnique({
      where: { currency_type: { currency: cashout.cryptoCurrency, type: 'CASHOUT' } },
    });

    let platformFee = new Decimal(0);
    if (feeConfig && feeConfig.isActive) {
      const { calculateFee } = await import('@/utils/fee.util');
      platformFee = calculateFee(idrGross, feeConfig);
    } else {
      // Default 1.5%
      platformFee = idrGross.mul(0.015);
    }

    const idrNet = idrGross.sub(exchangeFee).sub(platformFee);

    // 5. Update cashout with exchange info
    await prisma.cashoutRequest.update({
      where: { id: cashoutRequestId },
      data: {
        exchangeOrderId: filledOrder.orderId,
        exchangeRate: filledOrder.avgPrice.toFixed(8),
        exchangeFee: exchangeFee.toFixed(8),
        idrAmountGross: idrGross.toFixed(2),
        platformFee: platformFee.toFixed(2),
        idrAmountNet: idrNet.toFixed(2),
      },
    });

    // 6. Create disbursement via gateway (Flip primary, Xendit fallback)
    logger.info(`Creating disbursement for cashout ${cashoutRequestId}`, { idrNet, bankAccount: cashout.bankAccount.accountNumber });

    const disbursement = await gatewayFactory.createDisbursementWithFallback({
      externalId: cashoutRequestId,
      bankCode: cashout.bankAccount.bankCode,
      accountNumber: cashout.bankAccount.accountNumber,
      accountName: cashout.bankAccount.accountName,
      amount: idrNet,
      remark: `Cashout ${cashout.cryptoCurrency}`,
    });

    // 7. Update cashout: disbursement info, status → PROCESSING (waiting webhook)
    await prisma.cashoutRequest.update({
      where: { id: cashoutRequestId },
      data: {
        paymentProvider: disbursement.usedProvider,
        disbursementId: disbursement.disbursementId,
        status: disbursement.status === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
        ...(disbursement.status === 'COMPLETED' ? { disbursedAt: new Date(), completedAt: new Date() } : {}),
      },
    });

    // 8. If disbursement already completed (instant), finalize wallet
    if (disbursement.status === 'COMPLETED') {
      const wallet = await prisma.wallet.findFirst({
        where: { userId: cashout.userId, currency: cashout.cryptoCurrency, isActive: true },
      });
      if (wallet) {
        await deductLockedBalance(wallet.id, cryptoAmount);

        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'CASHOUT',
            status: 'COMPLETED',
            amount: cryptoAmount.toFixed(18),
            fee: exchangeFee.toFixed(18),
            netAmount: cryptoAmount.toFixed(18),
            currency: cashout.cryptoCurrency,
            reference: cashoutRequestId,
            confirmedAt: new Date(),
          },
        });
      }
    }

    logger.info(`Cashout ${cashoutRequestId} processed successfully`, { provider: disbursement.usedProvider });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Cashout ${cashoutRequestId} failed`, { error: errorMessage });

    // Unlock balance and mark failed
    const wallet = await prisma.wallet.findFirst({
      where: { userId: cashout.userId, currency: cashout.cryptoCurrency, isActive: true },
    });

    if (wallet) {
      const cryptoAmount = new Decimal(cashout.cryptoAmount.toString());
      await unlockBalance(wallet.id, cryptoAmount);
    }

    await prisma.cashoutRequest.update({
      where: { id: cashoutRequestId },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: errorMessage },
    });

    throw err; // Let BullMQ handle retries
  }
}

export function startCashoutWorker() {
  const worker = new Worker<CashoutJobData>('cashout', processCashout, {
    connection: redis,
    concurrency: Number(process.env.CASHOUT_JOB_CONCURRENCY) || 5,
  });

  worker.on('completed', (job) => logger.info(`Cashout job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Cashout job ${job?.id} failed`, { error: err.message }));

  return worker;
}
