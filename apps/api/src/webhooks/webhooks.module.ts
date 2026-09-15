import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOKS_QUEUE } from '../queue/queue.constants';
import { SyncModule } from '../sync/sync.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksProcessor } from './webhooks.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEBHOOKS_QUEUE,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 200, removeOnFail: 1000 },
    }),
    SyncModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksProcessor],
})
export class WebhooksModule {}
