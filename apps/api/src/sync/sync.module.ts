import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SYNC_QUEUE, CATEGORIZATION_QUEUE } from '../queue/queue.constants';
import { PluggyModule } from '../pluggy/pluggy.module';
import { InsightsModule } from '../insights/insights.module';
import { SyncService } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { SyncPollingService } from './sync-polling.service';

const defaultJobOptions = { removeOnComplete: 100, removeOnFail: 500 };

@Module({
  imports: [
    BullModule.registerQueue({ name: SYNC_QUEUE, defaultJobOptions }),
    BullModule.registerQueue({ name: CATEGORIZATION_QUEUE, defaultJobOptions }),
    PluggyModule,
    InsightsModule,
  ],
  providers: [SyncService, SyncProcessor, SyncPollingService],
  exports: [SyncService, BullModule],
})
export class SyncModule {}
