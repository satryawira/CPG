import { Queue } from 'bullmq';
import { getRedis } from '@/config/redis';

export interface CashoutJobData {
  cashoutRequestId: string;
}

let _cashoutQueue: Queue<CashoutJobData> | null = null;

export function getCashoutQueue(): Queue<CashoutJobData> {
  if (!_cashoutQueue) {
    _cashoutQueue = new Queue<CashoutJobData>('cashout', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return _cashoutQueue;
}

export const cashoutQueue = new Proxy({} as Queue<CashoutJobData>, {
  get(_target, prop) {
    return (getCashoutQueue() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
