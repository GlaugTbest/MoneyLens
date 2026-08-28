import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { CATEGORIZATION_QUEUE } from '../queue/queue.constants';
import { InsightsModule } from '../insights/insights.module';
import { CategorizationService } from './categorization.service';
import { CategorizationProcessor } from './categorization.processor';
import { GeminiService } from './gemini.service';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: CATEGORIZATION_QUEUE,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
    }),
    InsightsModule,
  ],
  providers: [CategorizationService, CategorizationProcessor, GeminiService],
  exports: [CategorizationService],
})
export class CategorizationModule {}
