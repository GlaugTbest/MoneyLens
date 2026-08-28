export const SYNC_QUEUE = 'sync';
export const WEBHOOKS_QUEUE = 'webhooks';
export const CATEGORIZATION_QUEUE = 'categorization';

export const SYNC_JOB = 'sync-item';
export const WEBHOOK_PROCESS_JOB = 'process-webhook';
export const CATEGORIZE_BATCH_JOB = 'categorize-batch';

export type SyncTrigger = 'INITIAL' | 'WEBHOOK' | 'MANUAL' | 'SCHEDULED_POLL';

export interface SyncJobData {
  itemId: string;
  trigger: SyncTrigger;
}
