import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MIN_RECURRING_OCCURRENCES = 3;
const RECURRING_LOOKBACK_MONTHS = 12;
const INTERVAL_CV_THRESHOLD = 0.3;
const AMOUNT_CV_THRESHOLD = 0.2;
const RECURRING_ENDED_MULTIPLIER = 2;

const ANOMALY_HISTORY_MONTHS = 6;
const ANOMALY_STDDEV_MULTIPLIER = 1.5;
const ANOMALY_MIN_ABSOLUTE = 50;

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSpendEvolution(userId: string, groupBy: 'day' | 'week' | 'month', from?: Date, to?: Date) {
    const truncUnit = groupBy === 'day' ? 'day' : groupBy === 'week' ? 'week' : 'month';
    const rows = await this.prisma.$queryRaw<Array<{ period: Date; total: string }>>(
      Prisma.sql`
        SELECT date_trunc(${truncUnit}, t.date) AS period, SUM(-t.amount) AS total
        FROM "Transaction" t
        JOIN "Account" a ON a.id = t."accountId"
        JOIN "Item" i ON i.id = a."itemId"
        WHERE i."userId" = ${userId}
          AND t."deletedAt" IS NULL
          AND t.amount < 0
        AND t."currencyCode" = 'BRL'
        AND i.status <> 'DELETED'
          ${from ? Prisma.sql`AND t.date >= ${from}` : Prisma.empty}
          ${to ? Prisma.sql`AND t.date <= ${to}` : Prisma.empty}
        GROUP BY period
        ORDER BY period ASC
      `,
    );
    const points = rows.map((r) => ({ period: r.period, totalSpent: Number(r.total) }));
    if (groupBy !== 'month' || !from || !to) return points;
    const byMonth = new Map(points.map((point) => [point.period.toISOString().slice(0, 7), point.totalSpent]));
    const filled = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    while (cursor <= to) {
      filled.push({ period: new Date(cursor), totalSpent: byMonth.get(cursor.toISOString().slice(0, 7)) ?? 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return filled;
  }

  async getTopCategories(userId: string, from?: Date, to?: Date) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        deletedAt: null,
        amount: { lt: 0 },
        currencyCode: 'BRL',
        account: { item: { userId, status: { not: 'DELETED' } } },
        ...(from || to
          ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      _sum: { amount: true },
    });

    const categories = await this.prisma.category.findMany();
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const total = rows.reduce((acc, r) => acc + Math.abs(Number(r._sum.amount ?? 0)), 0);

    return rows
      .map((r) => {
        const spent = Math.abs(Number(r._sum.amount ?? 0));
        return {
          categoryId: r.categoryId,
          categoryName: r.categoryId ? categoryById.get(r.categoryId)?.name ?? 'Outros' : 'Não categorizado',
          categorySlug: r.categoryId ? categoryById.get(r.categoryId)?.slug ?? null : null,
          totalSpent: spent,
          percentage: total > 0 ? spent / total : 0,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  async getConcentration(userId: string, from?: Date, to?: Date) {
    const topCategories = await this.getTopCategories(userId, from, to);
    const total = topCategories.reduce((acc, c) => acc + c.totalSpent, 0);
    const top3Share = topCategories.slice(0, 3).reduce((acc, c) => acc + c.totalSpent, 0);
    const herfindahl = topCategories.reduce((acc, c) => acc + c.percentage ** 2, 0);

    return {
      totalSpent: total,
      top3Share: total > 0 ? top3Share / total : 0,
      herfindahlIndex: herfindahl,
      categories: topCategories,
    };
  }

  getRecurring(userId: string) {
    return this.prisma.recurringExpenseGroup.findMany({
      where: { userId, status: 'ACTIVE', transactions: { some: { deletedAt: null, account: { item: { status: { not: 'DELETED' } } } } } },
      orderBy: { averageAmount: 'desc' },
      include: { category: true },
    });
  }

  async getAnomalies(userId: string, monthDate: Date = new Date()) {
    const currentMonthStart = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1));
    const historyStart = new Date(currentMonthStart);
    historyStart.setUTCMonth(historyStart.getUTCMonth() - ANOMALY_HISTORY_MONTHS);
    const nextMonthStart = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1));

    const rows = await this.prisma.$queryRaw<
      Array<{ categoryId: string | null; period: Date; total: string }>
    >(Prisma.sql`
      SELECT t."categoryId" AS "categoryId", date_trunc('month', t.date) AS period, SUM(-t.amount) AS total
      FROM "Transaction" t
      JOIN "Account" a ON a.id = t."accountId"
      JOIN "Item" i ON i.id = a."itemId"
      WHERE i."userId" = ${userId}
        AND t."deletedAt" IS NULL
        AND t.amount < 0
        AND t."currencyCode" = 'BRL'
        AND i.status <> 'DELETED'
        AND t.date >= ${historyStart}
        AND t.date < ${nextMonthStart}
        AND t."categoryId" IS NOT NULL
      GROUP BY t."categoryId", period
    `);

    const byCategory = new Map<string, { period: Date; total: number }[]>();
    for (const row of rows) {
      if (!row.categoryId) continue;
      const list = byCategory.get(row.categoryId) ?? [];
      list.push({ period: row.period, total: Number(row.total) });
      byCategory.set(row.categoryId, list);
    }

    const categories = await this.prisma.category.findMany();
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const anomalies: Array<{
      categoryId: string;
      categoryName: string;
      current: number;
      mean: number;
      stdDev: number;
      deltaPct: number | null;
    }> = [];

    for (const [categoryId, points] of byCategory) {
      const currentPoint = points.find(
        (p) => p.period.getTime() === currentMonthStart.getTime(),
      );
      const history = points.filter((p) => p.period.getTime() < currentMonthStart.getTime());
      if (!currentPoint || history.length < 3) continue;

      const mean = history.reduce((a, p) => a + p.total, 0) / history.length;
      const variance = history.reduce((a, p) => a + (p.total - mean) ** 2, 0) / history.length;
      const stdDev = Math.sqrt(variance);

      const isAnomalous =
        currentPoint.total > mean + ANOMALY_STDDEV_MULTIPLIER * stdDev &&
        currentPoint.total > ANOMALY_MIN_ABSOLUTE;

      if (isAnomalous) {
        anomalies.push({
          categoryId,
          categoryName: categoryById.get(categoryId)?.name ?? 'Outros',
          current: currentPoint.total,
          mean,
          stdDev,
          deltaPct: mean > 0 ? (currentPoint.total - mean) / mean : null,
        });
      }
    }

    return anomalies.sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0));
  }

  // Endpoint único para a página de Insights: evita 5 round-trips separados
  // do frontend e reaproveita o cálculo de top-categorias para a
  // concentração em vez de rodar a mesma agregação duas vezes.
  async getFullReport(userId: string) {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const [evolution, topCategories, recurring, anomalies] = await Promise.all([
      this.getSpendEvolution(userId, 'month', from, now),
      this.getTopCategories(userId, from, now),
      this.getRecurring(userId),
      this.getAnomalies(userId),
    ]);

    const total = topCategories.reduce((acc, c) => acc + c.totalSpent, 0);
    const top3Share = topCategories.slice(0, 3).reduce((acc, c) => acc + c.totalSpent, 0);
    const herfindahlIndex = topCategories.reduce((acc, c) => acc + c.percentage ** 2, 0);

    return {
      spendEvolution: evolution,
      topCategories,
      concentration: {
        totalSpent: total,
        top3Share: total > 0 ? top3Share / total : 0,
        herfindahlIndex,
      },
      recurring,
      anomalies,
    };
  }

  async getSummary(userId: string) {
    const now = new Date();
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [evolution, topCategories, recurring, anomalies] = await Promise.all([
      this.getSpendEvolution(userId, 'month', sixMonthsAgo, now),
      this.getTopCategories(userId, sixMonthsAgo, now),
      this.getRecurring(userId),
      this.getAnomalies(userId, now),
    ]);

    return {
      spendEvolution: evolution,
      topCategories: topCategories.slice(0, 5),
      recurringCount: recurring.length,
      recurringMonthlyTotal: recurring.reduce((a, r) => a + Number(r.averageAmount) * 30 / Math.max(1, r.intervalDays), 0),
      anomalies,
    };
  }

  // Job em lote — roda por usuário, agrupando débitos por normalizedMerchant
  // e checando regularidade de intervalo + estabilidade de valor.
  async detectRecurringForUser(userId: string) {
    const lookback = new Date();
    lookback.setMonth(lookback.getMonth() - RECURRING_LOOKBACK_MONTHS);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        amount: { lt: 0 },
        currencyCode: 'BRL',
        date: { gte: lookback },
        account: { item: { userId, status: { not: 'DELETED' } } },
        normalizedMerchant: { not: null },
      },
      select: { id: true, normalizedMerchant: true, amount: true, date: true, categoryId: true },
      orderBy: { date: 'asc' },
    });

    const byMerchant = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const key = tx.normalizedMerchant!;
      const list = byMerchant.get(key) ?? [];
      list.push(tx);
      byMerchant.set(key, list);
    }

    let detected = 0;
    const confirmed: string[] = [];

    for (const [merchant, txs] of byMerchant) {
      if (txs.length < MIN_RECURRING_OCCURRENCES) continue;

      const deltas: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const days = (txs[i].date.getTime() - txs[i - 1].date.getTime()) / 86_400_000;
        deltas.push(days);
      }
      const meanInterval = deltas.reduce((a, d) => a + d, 0) / deltas.length;
      if (meanInterval < 1) continue;
      const intervalStdDev = Math.sqrt(
        deltas.reduce((a, d) => a + (d - meanInterval) ** 2, 0) / deltas.length,
      );
      const intervalCv = intervalStdDev / meanInterval;

      const amounts = txs.map((t) => Math.abs(Number(t.amount)));
      const meanAmount = amounts.reduce((a, v) => a + v, 0) / amounts.length;
      const amountStdDev = Math.sqrt(
        amounts.reduce((a, v) => a + (v - meanAmount) ** 2, 0) / amounts.length,
      );
      const amountCv = meanAmount > 0 ? amountStdDev / meanAmount : 1;

      if (intervalCv > INTERVAL_CV_THRESHOLD || amountCv > AMOUNT_CV_THRESHOLD) continue;

      const confidence = Math.max(0, 1 - (intervalCv + amountCv) / 2);
      const lastSeenAt = txs[txs.length - 1].date;
      const status =
        Date.now() - lastSeenAt.getTime() > meanInterval * RECURRING_ENDED_MULTIPLIER * 86_400_000
          ? 'ENDED'
          : 'ACTIVE';

      const group = await this.prisma.recurringExpenseGroup.upsert({
        where: { userId_normalizedMerchant: { userId, normalizedMerchant: merchant } },
        create: {
          userId,
          normalizedMerchant: merchant,
          categoryId: txs[txs.length - 1].categoryId,
          averageAmount: meanAmount,
          intervalDays: Math.round(meanInterval),
          confidence,
          status,
          firstSeenAt: txs[0].date,
          lastSeenAt,
        },
        update: {
          categoryId: txs[txs.length - 1].categoryId,
          averageAmount: meanAmount,
          intervalDays: Math.round(meanInterval),
          confidence,
          status,
          lastSeenAt,
          lastComputedAt: new Date(),
        },
      });

      await this.prisma.transaction.updateMany({
        where: { id: { in: txs.map((t) => t.id) } },
        data: { recurringGroupId: group.id },
      });

      confirmed.push(group.id);
      detected += 1;
    }

    await this.prisma.recurringExpenseGroup.updateMany({
      where: { userId, id: { notIn: confirmed }, status: 'ACTIVE' },
      data: { status: 'ENDED', lastComputedAt: new Date() },
    });

    this.logger.log(`Recorrência detectada para ${detected} merchant(s) do usuário ${userId}`);
  }
}
