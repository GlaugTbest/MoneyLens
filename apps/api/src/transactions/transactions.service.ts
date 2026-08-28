import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListTransactionsDto) {
    const where: Prisma.TransactionWhereInput = {
      deletedAt: null,
      account: { item: { userId } },
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? { description: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [total, results] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return { total, page: query.page, pageSize: query.pageSize, results };
  }

  async getForUser(userId: string, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, account: { item: { userId } } },
      include: { category: true },
    });
    if (!tx) throw new NotFoundException('Transação não encontrada');
    return tx;
  }

  async updateCategory(userId: string, id: string, categoryId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id },
      include: { account: { include: { item: true } } },
    });
    if (!tx) throw new NotFoundException('Transação não encontrada');
    if (tx.account.item.userId !== userId) throw new ForbiddenException();

    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Categoria não encontrada');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { categoryId, categorizationSource: 'MANUAL', categorizationConfidence: 1 },
      include: { category: true },
    });

    if (tx.normalizedMerchant) {
      await this.prisma.merchantCategoryCache.upsert({
        where: { normalizedMerchant: tx.normalizedMerchant },
        create: {
          normalizedMerchant: tx.normalizedMerchant,
          categoryId,
          source: 'MANUAL',
          confidence: 1,
          sampleDescription: tx.description,
        },
        update: { categoryId, source: 'MANUAL', confidence: 1 },
      });
    }

    return updated;
  }
}
