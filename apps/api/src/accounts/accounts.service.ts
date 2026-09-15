import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.account.findMany({
      where: { item: { userId, status: { not: 'DELETED' } } },
      select: { id: true, name: true, type: true, subtype: true, balance: true, currencyCode: true, number: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  getForUser(userId: string, id: string) {
    return this.prisma.account.findFirst({
      where: { id, item: { userId, status: { not: 'DELETED' } } },
      select: { id: true, name: true, type: true, subtype: true, balance: true, currencyCode: true, number: true },
    });
  }
}
