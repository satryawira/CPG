import { Queue } from 'bullmq';
import { redis } from '@/config/redis';

export interface CashoutJobData {
  cashoutRequestId: string;
}

export const cashoutQueue = new Queue<CashoutJobData>('cashout', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 }, // keep 1 day
    removeOnFail: { age: 604800 },    // keep 7 days
  },
});
