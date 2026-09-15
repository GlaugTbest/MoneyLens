import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import { WEBHOOKS_QUEUE } from '../queue/queue.constants';

interface WebhookProcessJobData {
  webhookEventId: string;
}

@Processor(WEBHOOKS_QUEUE, { concurrency: 10 })
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {
    super();
  }

  async process(job: Job<WebhookProcessJobData>) {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: job.data.webhookEventId },
    });
    if (!event || !event.signatureValid || event.status === 'PROCESSED') return;

    try {
      const payload = event.payload as Record<string, unknown>;
      const itemId = event.itemId ?? (typeof payload.itemId === 'string' ? payload.itemId : null);
      if (itemId) {
        const item = await this.prisma.item.findUnique({ where: { id: itemId } });
        if (!item) throw new Error('Conexão ainda não registrada; aguardando nova tentativa');
        if (item.status !== 'DELETED') await this.dispatch(event.eventType, itemId, payload);
      }
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Falha processando webhook ${event.eventType}`, err as Error);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', error: (err as Error).message },
      });
      throw err;
    }
  }

  private async dispatch(
    eventType: string,
    itemId: string | null,
    payload: Record<string, unknown>,
  ) {
    switch (eventType) {
      case 'item/created':
      case 'item/updated': {
        if (!itemId) return;
        const remote = await this.syncService.syncItemStatus(itemId);
        if (remote.status === 'UPDATED' || remote.status === 'OUTDATED') {
          await this.syncService.enqueue(itemId, 'WEBHOOK');
        }
        return;
      }
      case 'item/error': {
        if (itemId) await this.syncService.syncItemStatus(itemId);
        return;
      }
      case 'item/deleted': {
        if (itemId) {
          await this.prisma.item.update({ where: { id: itemId }, data: { status: 'DELETED' } });
        }
        return;
      }
      case 'transactions/created':
      case 'transactions/updated': {
        if (!itemId) return;
        await this.syncService.enqueue(itemId, 'WEBHOOK');
        return;
      }
      case 'transactions/deleted': {
        const transactionIds = (payload.transactionIds as string[] | undefined) ?? [];
        if (itemId && transactionIds.length > 0) {
          await this.prisma.transaction.updateMany({
            where: { id: { in: transactionIds }, account: { itemId } },
            data: { deletedAt: new Date() },
          });
        }
        return;
      }
      default:
        this.logger.log(`Evento não tratado (apenas log): ${eventType}`);
    }
  }
}
