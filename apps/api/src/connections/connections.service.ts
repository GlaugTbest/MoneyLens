import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PluggyService } from '../pluggy/pluggy.service';
import { SyncService } from '../sync/sync.service';
import { mapPluggyStatus } from '../common/utils/map-pluggy-status';

const MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggy: PluggyService,
    private readonly syncService: SyncService,
  ) {}

  async createConnectToken(userId: string, itemId?: string) {
    if (itemId) {
      await this.getOwnedItem(userId, itemId);
    }
    const connectToken = await this.pluggy.createConnectToken({ itemId });
    return { connectToken };
  }

  async registerConnection(userId: string, itemId: string) {
    const remote = await this.pluggy.getItem(itemId);

    await this.prisma.item.upsert({
      where: { id: itemId },
      create: {
        id: itemId,
        userId,
        connectorId: remote.connector.id,
        connectorName: remote.connector.name,
        connectorImageUrl: remote.connector.imageUrl,
        status: mapPluggyStatus(remote.status),
        executionStatus: remote.executionStatus,
        error: remote.error ?? Prisma.JsonNull,
      },
      update: {
        status: mapPluggyStatus(remote.status),
        executionStatus: remote.executionStatus,
        error: remote.error ?? Prisma.JsonNull,
      },
    });

    await this.syncService.enqueue(itemId, 'INITIAL');
    return this.getOwnedItem(userId, itemId);
  }

  listConnections(userId: string) {
    return this.prisma.item.findMany({
      where: { userId, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnection(userId: string, id: string) {
    return this.getOwnedItem(userId, id);
  }

  async triggerManualSync(userId: string, id: string) {
    const item = await this.getOwnedItem(userId, id);
    if (item.lastSyncedAt && Date.now() - item.lastSyncedAt.getTime() < MANUAL_SYNC_COOLDOWN_MS) {
      throw new HttpException(
        'Aguarde alguns minutos antes de sincronizar novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.syncService.enqueue(id, 'MANUAL');
    return { queued: true };
  }

  async deleteConnection(userId: string, id: string) {
    await this.getOwnedItem(userId, id);
    await this.pluggy.deleteItem(id).catch(() => undefined);
    await this.prisma.item.update({ where: { id }, data: { status: 'DELETED' } });
    return { deleted: true };
  }

  private async getOwnedItem(userId: string, id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Conexão não encontrada');
    if (item.userId !== userId) throw new ForbiddenException();
    return item;
  }
}
