import axios from 'axios';
import crypto from 'crypto';
import { env } from '@/config/env';
import { AppError, HttpStatus } from '@/utils/AppError';
import { BaseGateway, DisbursementParams, DisbursementResult, DisbursementStatus } from './base.gateway';
import Decimal from 'decimal.js';

/**
 * Xendit Disbursement Integration
 * Docs: https://developers.xendit.co/api-reference/#disbursements
 * Supports 150+ banks in Indonesia, used as fallback after Flip.id
 */
export class XenditGateway extends BaseGateway {
  readonly name = 'XENDIT';
  private readonly baseUrl = 'https://api.xendit.co';
  private readonly secretKey: string;
  private readonly callbackToken: string;

  constructor() {
    super();
    this.secretKey = env.XENDIT_SECRET_KEY || '';
    this.callbackToken = env.XENDIT_CALLBACK_TOKEN || '';
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`;
  }

  async createDisbursement(params: DisbursementParams): Promise<DisbursementResult> {
    const response = await axios.post(
      `${this.baseUrl}/disbursements`,
      {
        external_id: params.externalId,
        bank_code: params.bankCode.toUpperCase(),
        account_holder_name: params.accountName,
        account_number: params.accountNumber,
        description: params.remark || 'Cashout',
        amount: params.amount.toNumber(),
      },
      {
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data as { id: string; status: string; amount: number; fee_paid: number };

    return {
      disbursementId: data.id,
      status: this.mapStatus(data.status),
      amount: new Decimal(data.amount),
      fee: new Decimal(data.fee_paid || 0),
      provider: this.name,
    };
  }

  async getDisbursementStatus(disbursementId: string): Promise<DisbursementStatus> {
    const response = await axios.get(`${this.baseUrl}/disbursements/${disbursementId}`, {
      headers: { Authorization: this.authHeader() },
    });

    const data = response.data as { id: string; status: string; amount: number; failure_code?: string };

    return {
      disbursementId: data.id,
      status: this.mapStatus(data.status),
      amount: new Decimal(data.amount),
      failureReason: data.failure_code,
    };
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    return signature === this.callbackToken;
  }

  private mapStatus(status: string): DisbursementResult['status'] {
    const map: Record<string, DisbursementResult['status']> = {
      PENDING: 'PENDING',
      IN_PROCESS: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
    };
    return map[status?.toUpperCase()] || 'PENDING';
  }
}
