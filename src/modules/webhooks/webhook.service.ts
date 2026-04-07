import Decimal from 'decimal.js';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { deductLockedBalance } from '@/modules/wallet/wallet.service';
import { gatewayFactory } from '@/integrations/payment-gateways/gateway.factory';

export async function handleFlipWebhook(rawBody: Buffer, signature: string, payload: unknown) {
  const flip = gatewayFactory.getGateway('FLIP');
  if (!flip.verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Flip webhook signature verification failed');
    return { status: 'ignored' };
  }

  const data = payload as { id: number; status: string; idempotency_key?: string };
  const cashoutId = data.idempotency_key;
  if (!cashoutId) return { status: 'no_cashout_id' };

  await finalizeDisbursement('FLIP', String(data.id), cashoutId, data.status === 'DONE');
  return { status: 'processed' };
}

export async function handleXenditWebhook(callbackToken: string, payload: unknown) {
  if (callbackToken !== (process.env.XENDIT_CALLBACK_TOKEN || '')) {
    logger.warn('Xendit webhook token mismatch');
    return { status: 'ignored' };
  }

  const data = payload as { id: string; external_id: string; status: string; failure_code?: string };
  const cashoutId = data.external_id;

  await finalizeDisbursement('XENDIT', data.id, cashoutId, data.status === 'COMPLETED', data.failure_code);
  return { status: 'processed' };
}

export async function handleMidtransWebhook(rawBody: Buffer, signatureKey: string, payload: unknown) {
  const midtrans = gatewayFactory.getGateway('MIDTRANS');
  if (!midtrans.verifyWebhookSignature(rawBody, signatureKey)) {
    logger.warn('Midtrans webhook signature verification failed');
    return { status: 'ignored' };
  }

  // Midtrans is for topup/payment — log and acknowledge
  logger.info('Midtrans payment notification received', { payload });
  return { status: 'acknowledged' };
}

async function finalizeDisbursement(provider: string, disbursementId: string, cashoutId: string, success: boolean, failureReason?: string) {
  const cashout = await prisma.cashoutRequest.findUnique({ where: { id: cashoutId } });

  if (!cashout) {
    logger.error(`Cashout not found for disbursement webhook`, { cashoutId, disbursementId });
    return;
  }

  if (cashout.status === 'COMPLETED' || cashout.status === 'FAILED') {
    logger.info(`Cashout ${cashoutId} already finalized, ignoring webhook`);
    return;
  }

  if (success) {
    // Deduct locked balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId: cashout.userId, currency: cashout.cryptoCurrency, isActive: true },
    });

    if (wallet) {
      const cryptoAmount = new Decimal(cashout.cryptoAmount.toString());
      await deductLockedBalance(wallet.id, cryptoAmount);

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'CASHOUT',
          status: 'COMPLETED',
          amount: cryptoAmount.toFixed(18),
          fee: cashout.exchangeFee?.toString() || '0',
          netAmount: cryptoAmount.toFixed(18),
          currency: cashout.cryptoCurrency,
          reference: cashoutId,
          confirmedAt: new Date(),
          metadata: { disbursementId, provider },
        },
      });
    }

    await prisma.cashoutRequest.update({
      where: { id: cashoutId },
      data: { status: 'COMPLETED', disbursedAt: new Date(), completedAt: new Date(), disbursementId },
    });

    logger.info(`Cashout ${cashoutId} completed via ${provider}`);
  } else {
    // Disbursement failed — unlock balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId: cashout.userId, currency: cashout.cryptoCurrency, isActive: true },
    });

    if (wallet) {
      const { unlockBalance } = await import('@/modules/wallet/wallet.service');
      await unlockBalance(wallet.id, new Decimal(cashout.cryptoAmount.toString()));
    }

    await prisma.cashoutRequest.update({
      where: { id: cashoutId },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: failureReason || 'Disbursement failed' },
    });

    logger.error(`Cashout ${cashoutId} failed: ${failureReason}`);
  }
}
