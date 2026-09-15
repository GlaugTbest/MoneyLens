import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PluggyService } from '../pluggy/pluggy.service';
import {
  CATEGORIZATION_QUEUE,
  CATEGORIZE_BATCH_JOB,
  SYNC_JOB,
  SYNC_QUEUE,
  SyncJobData,
  SyncTrigger,
} from '../queue/queue.constants';
import { AccountType, Prisma, TransactionType } from '@prisma/client';
import { PluggyItem } from '../pluggy/pluggy.types';
import { normalizeMerchant } from '../common/utils/normalize-merchant';
import { mapPluggyStatus } from '../common/utils/map-pluggy-status';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggy: PluggyService,
    @InjectQueue(SYNC_QUEUE) private readonly syncQueue: Queue<SyncJobData>,
    @InjectQueue(CATEGORIZATION_QUEUE) private readonly categorizationQueue: Queue,
    private readonly insights: InsightsService,
  ) {}

  async enqueue(itemId: string, trigger: SyncTrigger) {
    await this.syncQueue.add(
      SYNC_JOB,
      { itemId, trigger },
      { deduplication: { id: itemId, keepLastIfActive: true } },
    );
  }

  async syncItemStatus(itemId: string): Promise<PluggyItem> {
    const remote = await this.pluggy.getItem(itemId);
    await this.prisma.item.updateMany({
      where: { id: itemId, status: { not: 'DELETED' } },
      data: {
        status: mapPluggyStatus(remote.status),
        executionStatus: remote.executionStatus,
        error: remote.error ?? Prisma.JsonNull,
        connectorName: remote.connector.name,
        connectorImageUrl: remote.connector.imageUrl,
      },
    });
    return remote;
  }

  async runSync(itemId: string, trigger: SyncTrigger) {
    const localItem = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!localItem || localItem.status === 'DELETED') return;
    const syncLog = await this.prisma.syncLog.create({
      data: { itemId, trigger, status: 'RUNNING' },
    });

    let created = 0;
    let updated = 0;

    try {
      const remoteItem = await this.syncItemStatus(itemId);

      if (remoteItem.status !== 'UPDATED' && remoteItem.status !== 'OUTDATED') {
        // Item ainda sincronizando no Pluggy (ou em erro) — nada para buscar ainda.
        await this.prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { status: 'SUCCESS', finishedAt: new Date() },
        });
        return;
      }

      const accountsResponse = await this.pluggy.listAccounts(itemId);

      for (const remoteAccount of accountsResponse.results) {
        await this.prisma.account.upsert({
          where: { id: remoteAccount.id },
          create: {
            id: remoteAccount.id,
            itemId,
            type: remoteAccount.type as AccountType,
            subtype: remoteAccount.subtype,
            name: remoteAccount.name,
            number: remoteAccount.number,
            balance: remoteAccount.balance,
            currencyCode: remoteAccount.currencyCode,
            raw: remoteAccount as unknown as object,
          },
          update: {
            balance: remoteAccount.balance,
            name: remoteAccount.name,
            raw: remoteAccount as unknown as object,
          },
        });

        for await (const page of this.pluggy.listAllTransactions(remoteAccount.id)) {
          for (const tx of page) {
            const normalizedMerchant = normalizeMerchant(
              tx.merchant?.businessName ?? tx.description,
            );

            const existing = await this.prisma.transaction.findUnique({ where: { id: tx.id } });

            await this.prisma.transaction.upsert({
              where: { id: tx.id },
              create: {
                id: tx.id,
                accountId: tx.accountId,
                description: tx.description,
                descriptionRaw: tx.descriptionRaw,
                merchantName: tx.merchant?.businessName ?? null,
                normalizedMerchant,
                amount: tx.amount,
                type: tx.type as TransactionType,
                date: new Date(tx.date),
                currencyCode: tx.currencyCode,
                pluggyCategoryId: tx.categoryId,
                pluggyCategory: tx.category,
                raw: tx as unknown as object,
              },
              update: {
                description: tx.description,
                amount: tx.amount,
                pluggyCategoryId: tx.categoryId,
                pluggyCategory: tx.category,
                raw: tx as unknown as object,
              },
            });

            if (existing) {
              updated += 1;
            } else {
              created += 1;
            }
          }
        }
      }

      await this.prisma.item.update({
        where: { id: itemId },
        data: {
          lastSyncedAt: new Date(),
          lastUpdatedAtPluggy: remoteItem.lastUpdatedAt ? new Date(remoteItem.lastUpdatedAt) : null,
        },
      });

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          transactionsCreated: created,
          transactionsUpdated: updated,
        },
      });

      // Recover uncategorized records left by a partially completed earlier sync.
      const pending = await this.prisma.transaction.findMany({
        where: { account: { itemId }, categoryId: null, deletedAt: null },
        select: { id: true },
      });
      for (let offset = 0; offset < pending.length; offset += 200) {
        await this.categorizationQueue.add(CATEGORIZE_BATCH_JOB, {
          transactionIds: pending.slice(offset, offset + 200).map((tx) => tx.id),
        });
      }

      if (trigger === 'INITIAL') {
        const item = await this.prisma.item.findUnique({ where: { id: itemId } });
        if (item) await this.insights.detectRecurringForUser(item.userId);
      }
    } catch (err) {
      this.logger.error(`Sync falhou para item ${itemId}`, err as Error);
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: (err as Error).message,
        },
      });
      throw err;
    }
  }
}
