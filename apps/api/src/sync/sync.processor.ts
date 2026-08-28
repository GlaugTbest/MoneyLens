import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SyncService } from './sync.service';
import { SYNC_QUEUE, SyncJobData } from '../queue/queue.constants';

@Processor(SYNC_QUEUE, { concurrency: 3 })
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<SyncJobData>) {
    const { itemId, trigger } = job.data;
    this.logger.log(`Sincronizando item ${itemId} (trigger=${trigger})`);
    await this.syncService.runSync(itemId, trigger);
  }
}
