import { FlipGateway } from './flip.gateway';
import { XenditGateway } from './xendit.gateway';
import { MidtransGateway } from './midtrans.gateway';
import { BaseGateway, DisbursementParams, DisbursementResult } from './base.gateway';
import type { PaymentProvider } from '@prisma/client';
import { logger } from '@/config/logger';

class GatewayFactory {
  private gateways: Map<PaymentProvider, BaseGateway>;

  constructor() {
    this.gateways = new Map([
      ['FLIP', new FlipGateway()],
      ['XENDIT', new XenditGateway()],
      ['MIDTRANS', new MidtransGateway()],
    ]);
  }

  getGateway(provider: PaymentProvider): BaseGateway {
    const gateway = this.gateways.get(provider);
    if (!gateway) throw new Error(`Unknown payment provider: ${provider}`);
    return gateway;
  }

  /**
   * Create disbursement with primary gateway (Flip), fallback to Xendit.
   * Returns the result along with the provider used.
   */
  async createDisbursementWithFallback(params: DisbursementParams): Promise<DisbursementResult & { usedProvider: PaymentProvider }> {
    const primaryOrder: PaymentProvider[] = ['FLIP', 'XENDIT'];

    for (const provider of primaryOrder) {
      try {
        const gateway = this.getGateway(provider);
        const result = await gateway.createDisbursement(params);
        return { ...result, usedProvider: provider };
      } catch (err) {
        logger.warn(`Disbursement failed on ${provider}, trying next`, { error: err, params });
      }
    }

    throw new Error('All disbursement gateways failed');
  }
}

export const gatewayFactory = new GatewayFactory();
