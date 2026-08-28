import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from './sync.service';

// Rede de segurança caso um webhook do Pluggy seja perdido — não confiar
// apenas em webhooks para manter os dados sincronizados.
@Injectable()
export class SyncPollingService {
  private readonly logger = new Logger(SyncPollingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async pollActiveItems() {
    const items = await this.prisma.item.findMany({
      where: { status: { not: 'DELETED' } },
      select: { id: true },
    });

    this.logger.log(`Polling de segurança: ${items.length} item(s) ativos`);
    for (const item of items) {
      await this.syncService.enqueue(item.id, 'SCHEDULED_POLL');
    }
  }
}
