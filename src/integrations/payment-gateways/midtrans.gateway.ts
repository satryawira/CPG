import crypto from 'crypto';
import { env } from '@/config/env';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseGateway, DisbursementParams, DisbursementResult, DisbursementStatus } from './base.gateway';
import Decimal from 'decimal.js';

/**
 * Midtrans Integration
 * Primarily used for accepting fiat payments (topup flow), not disbursement.
 * Webhook signature verification for payment notifications.
 * Docs: https://docs.midtrans.com/
 */
export class MidtransGateway extends BaseGateway {
  readonly name = 'MIDTRANS';
  private readonly serverKey: string;
  private readonly notificationKey: string;

  constructor() {
    super();
    this.serverKey = env.MIDTRANS_SERVER_KEY || '';
    this.notificationKey = env.MIDTRANS_NOTIFICATION_KEY || '';
  }

  // Midtrans is NOT a disbursement gateway — throw if called
  async createDisbursement(_params: DisbursementParams): Promise<DisbursementResult> {
    throw new AppError('Midtrans does not support disbursement', HttpStatus.BAD_REQUEST);
  }

  async getDisbursementStatus(_disbursementId: string): Promise<DisbursementStatus> {
    throw new AppError('Midtrans does not support disbursement status', HttpStatus.BAD_REQUEST);
  }

  /**
   * Verify Midtrans payment notification signature.
   * signature_key = SHA512(order_id + status_code + gross_amount + server_key)
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    let body: { order_id?: string; status_code?: string; gross_amount?: string };
    try {
      body = JSON.parse(Buffer.isBuffer(payload) ? payload.toString() : payload);
    } catch {
      return false;
    }

    const { order_id, status_code, gross_amount } = body;
    if (!order_id || !status_code || !gross_amount) return false;

    const expected = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${this.serverKey}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
