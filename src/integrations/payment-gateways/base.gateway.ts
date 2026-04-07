import Decimal from 'decimal.js';

export interface DisbursementParams {
  externalId: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: Decimal; // in IDR
  remark?: string;
}

export interface DisbursementResult {
  disbursementId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  amount: Decimal;
  fee: Decimal;
  provider: string;
}

export interface DisbursementStatus {
  disbursementId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  amount: Decimal;
  failureReason?: string;
}

export abstract class BaseGateway {
  abstract readonly name: string;

  abstract createDisbursement(params: DisbursementParams): Promise<DisbursementResult>;
  abstract getDisbursementStatus(disbursementId: string): Promise<DisbursementStatus>;
  abstract verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
