import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { InsightsSchedulerService } from './insights-scheduler.service';

@Module({
  controllers: [InsightsController],
  providers: [InsightsService, InsightsSchedulerService],
  exports: [InsightsService],
})
export class InsightsModule {}
