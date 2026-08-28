import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

@Injectable()
export class InsightsSchedulerService {
  private readonly logger = new Logger(InsightsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async detectRecurringForAllUsers() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    this.logger.log(`Detectando recorrências para ${users.length} usuário(s)`);
    for (const user of users) {
      await this.insights.detectRecurringForUser(user.id);
    }
  }
}
