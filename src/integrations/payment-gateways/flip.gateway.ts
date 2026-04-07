import axios from 'axios';
import crypto from 'crypto';
import { env } from '@/config/env';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseGateway, DisbursementParams, DisbursementResult, DisbursementStatus } from './base.gateway';
import Decimal from 'decimal.js';

/**
 * Flip.id Disbursement Integration
 * Docs: https://docs.flip.id/
 * Most cost-effective for bank transfers in Indonesia (Rp 1.000–3.500/transfer)
 */
export class FlipGateway extends BaseGateway {
  readonly name = 'FLIP';
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly validationToken: string;

  constructor() {
    super();
    this.baseUrl = env.FLIP_BASE_URL;
    this.secretKey = env.FLIP_SECRET_KEY || '';
    this.validationToken = env.FLIP_VALIDATION_TOKEN || '';
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async createDisbursement(params: DisbursementParams): Promise<DisbursementResult> {
    const response = await axios.post(
      `${this.baseUrl}/disbursement`,
      new URLSearchParams({
        account_number: params.accountNumber,
        bank_code: params.bankCode.toUpperCase(),
        amount: params.amount.toFixed(0),
        remark: params.remark || 'Cashout',
        recipient_name: params.accountName,
        idempotency_key: params.externalId,
      }).toString(),
      {
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const data = response.data as { id: number; status: string; amount: number; fee: number };

    return {
      disbursementId: String(data.id),
      status: this.mapStatus(data.status),
      amount: new Decimal(data.amount),
      fee: new Decimal(data.fee || 0),
      provider: this.name,
    };
  }

  async getDisbursementStatus(disbursementId: string): Promise<DisbursementStatus> {
    const response = await axios.get(`${this.baseUrl}/disbursement/${disbursementId}`, {
      headers: { Authorization: this.authHeader() },
    });

    const data = response.data as { id: number; status: string; amount: number; reason?: string };

    return {
      disbursementId: String(data.id),
      status: this.mapStatus(data.status),
      amount: new Decimal(data.amount),
      failureReason: data.reason,
    };
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    if (!this.validationToken) return false;
    const expected = crypto
      .createHmac('sha256', this.validationToken)
      .update(Buffer.isBuffer(payload) ? payload : Buffer.from(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  private mapStatus(status: string): DisbursementResult['status'] {
    const map: Record<string, DisbursementResult['status']> = {
      PENDING: 'PENDING',
      PROCESS: 'PROCESSING',
      DONE: 'COMPLETED',
      CANCELLED: 'FAILED',
    };
    return map[status?.toUpperCase()] || 'PENDING';
  }
}
