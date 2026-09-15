import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { ConnectionsService } from '../src/connections/connections.service';
import { AuthService } from '../src/auth/auth.service';
import { TransactionsService } from '../src/transactions/transactions.service';
import { CategorizationService } from '../src/categorization/categorization.service';
import { SyncService } from '../src/sync/sync.service';
import { WebhooksController } from '../src/webhooks/webhooks.controller';
import { WebhooksProcessor } from '../src/webhooks/webhooks.processor';
import { InsightsService } from '../src/insights/insights.service';
import { GeminiService } from '../src/categorization/gemini.service';
import { AppConfigService } from '../src/config/config.service';

// Deliberately small in-memory doubles: these are regression tests, not live integration claims.
const stub = <T>(value: unknown) => value as T;

describe('connection ownership and revocation', () => {
  function setup(local: unknown = null, owner: string | null = 'alice') {
    const prisma = { item: { findUnique: jest.fn().mockResolvedValue(local), upsert: jest.fn(), update: jest.fn() } };
    const pluggy = { getItem: jest.fn().mockResolvedValue({ clientUserId: owner, connector: { id: 1 }, status: 'UPDATED' }), deleteItem: jest.fn(), createConnectToken: jest.fn().mockResolvedValue('token') };
    const sync = { enqueue: jest.fn() };
    const service = new ConnectionsService(stub(prisma), stub(pluggy), stub(sync));
    return { prisma, pluggy, sync, service };
  }

  it('rejects another local owner before external calls or writes', async () => {
    const { service, pluggy, prisma, sync } = setup({ id: 'item', userId: 'bob', status: 'UPDATED' });
    await expect(service.registerConnection('alice', 'item')).rejects.toBeInstanceOf(ForbiddenException);
    expect(pluggy.getItem).not.toHaveBeenCalled();
    expect(prisma.item.upsert).not.toHaveBeenCalled();
    expect(sync.enqueue).not.toHaveBeenCalled();
  });

  it.each(['bob', null])('does not claim an unregistered remote item with owner %s', async (owner) => {
    const { service, prisma, sync } = setup(null, owner);
    await expect(service.registerConnection('alice', 'item')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.item.upsert).not.toHaveBeenCalled();
    expect(sync.enqueue).not.toHaveBeenCalled();
  });

  it('puts the authenticated user into the server-created connect token', async () => {
    const { service, pluggy } = setup();
    await service.createConnectToken('alice');
    expect(pluggy.createConnectToken).toHaveBeenCalledWith({ itemId: undefined, clientUserId: 'alice' });
  });

  it('does not report a local deletion when remote revocation fails', async () => {
    const { service, pluggy, prisma } = setup({ id: 'item', userId: 'alice', status: 'UPDATED' });
    pluggy.deleteItem.mockRejectedValue(new Error('unavailable'));
    await expect(service.deleteConnection('alice', 'item')).rejects.toThrow('unavailable');
    expect(prisma.item.update).not.toHaveBeenCalled();
  });
});

describe('refresh rotation', () => {
  it('allows only one consumer of a refresh token', async () => {
    let consumed = false;
    const create = jest.fn();
    const db = { refreshToken: {
      updateMany: jest.fn(async ({ where }) => {
        if (where.revokedAt !== null || !where.expiresAt.gt || consumed) return { count: 0 };
        consumed = true;
        return { count: 1 };
      }), create,
    } };
    const prisma = { $transaction: (fn: (db: unknown) => unknown) => fn(db) };
    const jwt = { verify: () => ({ sub: 'alice', email: 'alice@example.test', jti: 'one' }), sign: () => 'new-token', decode: () => ({ exp: 2_000_000_000 }) };
    const auth = new AuthService(stub({}), stub(prisma), stub<JwtService>(jwt), stub({}));
    const results = await Promise.allSettled([auth.refresh('same-token'), auth.refresh('same-token')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('manual categorization', () => {
  it('keeps a manual edit out of the shared cache and strips raw data', async () => {
    const tx = { id: 'tx', normalizedMerchant: 'market', deletedAt: null, account: { item: { userId: 'alice', status: 'UPDATED' } } };
    const prisma = { transaction: { findFirst: jest.fn().mockResolvedValue(tx), update: jest.fn().mockResolvedValue({ id: 'tx', categoryId: 'food', raw: { private: true } }) }, category: { findUnique: jest.fn().mockResolvedValue({ id: 'food' }) }, merchantCategoryCache: { upsert: jest.fn() } };
    const service = new TransactionsService(stub(prisma));
    const result = await service.updateCategory('alice', 'tx', 'food');
    expect(result).toEqual({ id: 'tx', categoryId: 'food' });
    expect(prisma.merchantCategoryCache.upsert).not.toHaveBeenCalled();
    await expect(service.updateCategory('bob', 'tx', 'food')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.transaction.update).toHaveBeenCalledTimes(1);
  });

  it('ignores legacy MANUAL cache rows and guards the final automatic write', async () => {
    const prisma = {
      category: { findMany: jest.fn().mockResolvedValue([{ id: 'other', slug: 'outros' }]) },
      categorizationRule: { findMany: jest.fn().mockResolvedValue([]) },
      transaction: {
        findMany: jest.fn().mockResolvedValue([{ id: 'tx', normalizedMerchant: 'market', description: 'Market', account: { item: { userId: 'alice' } } }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      merchantCategoryCache: { findUnique: jest.fn().mockResolvedValue({ source: 'MANUAL', categoryId: 'bob-choice' }), update: jest.fn() },
    };
    const service = new CategorizationService(stub(prisma), stub({}), stub({ llmCategorizationEnabled: false }), stub({ detectRecurringForUser: jest.fn() }));
    await service.categorizeTransactions(['tx']);
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'tx', categoryId: null }),
      data: expect.objectContaining({ categoryId: 'other' }),
    }));
    expect(prisma.merchantCategoryCache.update).not.toHaveBeenCalled();
  });
});

describe('sync recovery', () => {
  it('deduplicates by item only while work is outstanding, across triggers', async () => {
    const queue = { add: jest.fn() };
    const service = new SyncService(stub({}), stub({}), stub(queue), stub({}), stub({}));
    await service.enqueue('item', 'WEBHOOK');
    await service.enqueue('item', 'MANUAL');
    for (const call of queue.add.mock.calls) {
      expect(call[2]).toEqual({ deduplication: { id: 'item', keepLastIfActive: true } });
    }
  });

  it('skips previously disconnected items without calling the provider', async () => {
    const pluggy = { getItem: jest.fn() };
    const service = new SyncService(stub({ item: { findUnique: jest.fn().mockResolvedValue({ status: 'DELETED' }) } }), stub(pluggy), stub({}), stub({}), stub({}));
    await service.runSync('item', 'WEBHOOK');
    expect(pluggy.getItem).not.toHaveBeenCalled();
  });

  it('queues uncategorized records from a previous partial sync', async () => {
    const prisma = {
      item: { findUnique: jest.fn().mockResolvedValue({ status: 'UPDATED' }), updateMany: jest.fn(), update: jest.fn() },
      syncLog: { create: jest.fn().mockResolvedValue({ id: 'log' }), update: jest.fn() },
      transaction: { findMany: jest.fn().mockResolvedValue([{ id: 'older-unclassified' }]) },
    };
    const pluggy = { getItem: jest.fn().mockResolvedValue({ status: 'UPDATED', connector: { name: 'Sandbox' } }), listAccounts: jest.fn().mockResolvedValue({ results: [] }) };
    const queue = { add: jest.fn() };
    const service = new SyncService(stub(prisma), stub(pluggy), stub({}), stub(queue), stub({}));
    await service.runSync('item', 'WEBHOOK');
    expect(queue.add).toHaveBeenCalledWith('categorize-batch', { transactionIds: ['older-unclassified'] });
  });
});

describe('webhook authentication and replay', () => {
  const payload = { event: 'item/updated', eventId: 'event-1', itemId: 'item' };
  function setup() {
    const prisma = { item: { findUnique: jest.fn().mockResolvedValue({ id: 'item' }) }, webhookEvent: { upsert: jest.fn().mockResolvedValue({ id: 'stored', status: 'PENDING' }) } };
    const queue = { add: jest.fn() };
    const controller = new WebhooksController(stub(prisma), stub({ pluggyWebhookSecret: 'secret', nodeEnv: 'production' }), stub(queue));
    return { prisma, queue, controller };
  }

  it('rejects an invalid secret before reading or writing the database', async () => {
    const { controller, prisma } = setup();
    await expect(controller.handlePluggyWebhook(payload, 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.item.findUnique).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.upsert).not.toHaveBeenCalled();
  });

  it('validates the runtime payload', async () => {
    const { controller, prisma } = setup();
    await expect(controller.handlePluggyWebhook({ event: 7 }, 'secret')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.webhookEvent.upsert).not.toHaveBeenCalled();
  });

  it('recovers the same persisted event after a queue outage', async () => {
    const { controller, prisma, queue } = setup();
    queue.add.mockRejectedValueOnce(new Error('redis unavailable')).mockResolvedValueOnce({});
    await expect(controller.handlePluggyWebhook(payload, 'secret')).rejects.toThrow('redis unavailable');
    await expect(controller.handlePluggyWebhook(payload, 'secret')).resolves.toEqual({ received: true });
    for (const [query] of prisma.webhookEvent.upsert.mock.calls) expect(query.where).toEqual({ externalEventId: 'event-1' });
    prisma.webhookEvent.upsert.mockResolvedValue({ id: 'stored', status: 'PROCESSED' });
    await controller.handlePluggyWebhook(payload, 'secret');
    expect(queue.add).toHaveBeenCalledTimes(2);
  });

  it('scopes transaction deletion to the owning item', async () => {
    const prisma = { webhookEvent: { findUnique: jest.fn().mockResolvedValue({ id: 'event', eventType: 'transactions/deleted', signatureValid: true, itemId: 'item', payload: { transactionIds: ['tx'] } }), update: jest.fn() }, item: { findUnique: jest.fn().mockResolvedValue({ status: 'UPDATED' }) }, transaction: { updateMany: jest.fn() } };
    const processor = new WebhooksProcessor(stub(prisma), stub({}));
    await processor.process(stub({ data: { webhookEventId: 'event' } }));
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['tx'] }, account: { itemId: 'item' } } }));
  });
});

describe('insight semantics and managed Redis', () => {
  it('fills missing calendar months with zero', async () => {
    const service = new InsightsService(stub({ $queryRaw: jest.fn().mockResolvedValue([{ period: new Date('2026-08-01Z'), total: '42' }]) }));
    const points = await service.getSpendEvolution('alice', 'month', new Date('2026-07-01Z'), new Date('2026-09-14Z'));
    expect(points.map((point) => point.totalSpent)).toEqual([0, 42, 0]);
  });

  it('normalizes recurring amounts to a 30-day estimate', async () => {
    const service = new InsightsService(stub({}));
    jest.spyOn(service, 'getSpendEvolution').mockResolvedValue([]);
    jest.spyOn(service, 'getTopCategories').mockResolvedValue([]);
    jest.spyOn(service, 'getAnomalies').mockResolvedValue([]);
    jest.spyOn(service, 'getRecurring').mockResolvedValue(stub([{ averageAmount: 70, intervalDays: 7 }, { averageAmount: 360, intervalDays: 360 }]));
    const summary = await service.getSummary('alice');
    expect(summary.recurringMonthlyTotal).toBe(330);
  });

  it('preserves TLS, ACL credentials and database index in Redis URLs', () => {
    const config = new AppConfigService(stub({ get: () => 'rediss://worker:p%40ss@example.test:6380/2' }));
    expect(config.redisConnection).toEqual({ host: 'example.test', port: 6380, username: 'worker', password: 'p@ss', db: 2, tls: {} });
  });
});

describe('LLM output', () => {
  it('rejects duplicated indices instead of accepting a misleading classification', async () => {
    const response = [{ index: 0, category: 'outros', confidence: 1 }, { index: 0, category: 'outros', confidence: 1 }];
    const http = { post: () => of({ data: { candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] } }) };
    const service = new GeminiService(stub(http), stub({ geminiModel: 'test', geminiApiKey: 'test' }));
    await expect(service.classifyBatch([{ index: 0, description: 'a', amount: -1 }, { index: 1, description: 'b', amount: -2 }])).rejects.toThrow('resposta inválida');
  });
});
