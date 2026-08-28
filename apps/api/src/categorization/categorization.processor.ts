import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CategorizationService } from './categorization.service';
import { CATEGORIZATION_QUEUE } from '../queue/queue.constants';

@Processor(CATEGORIZATION_QUEUE, { concurrency: 2 })
export class CategorizationProcessor extends WorkerHost {
  private readonly logger = new Logger(CategorizationProcessor.name);

  constructor(private readonly categorization: CategorizationService) {
    super();
  }

  async process(job: Job<{ transactionIds: string[] }>) {
    this.logger.log(`Categorizando lote de ${job.data.transactionIds.length} transação(ões)`);
    await this.categorization.categorizeTransactions(job.data.transactionIds);
  }
}
