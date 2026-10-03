import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
export const workflowQueue = new Queue('aios-workflows', { connection: redis, defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 } });
