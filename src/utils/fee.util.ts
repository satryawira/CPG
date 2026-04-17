import Decimal from 'decimal.js';
import { FeeConfig } from '@prisma/client';

export function calculateFee(amount: Decimal, config: FeeConfig): Decimal {
  const percentFee = amount.mul(config.feePercent.toString());
  const totalFee = percentFee.add(config.feeFlat.toString());
  const minFee = new Decimal(config.minFee.toString());
  const clampedFee = Decimal.max(minFee, totalFee);

  if (config.maxFee) {
    return Decimal.min(new Decimal(config.maxFee.toString()), clampedFee);
  }

  return clampedFee;
}

export function calculateNetAmount(grossAmount: Decimal, fee: Decimal): Decimal {
  return grossAmount.sub(fee);
}
