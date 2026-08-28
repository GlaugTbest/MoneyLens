import { Injectable, Logger } from '@nestjs/common';
import { CategorizationSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { GeminiService } from './gemini.service';
import { PLUGGY_CATEGORY_MAP } from './pluggy-category-map';
import { InsightsService } from '../insights/insights.service';

const LLM_CONFIDENCE_THRESHOLD = 0.5;
const LLM_BATCH_SIZE = 20;
const OUTROS_SLUG = 'outros';

interface Rule {
  categoryId: string;
  matchType: string;
  pattern: string;
}

@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly config: AppConfigService,
    private readonly insights: InsightsService,
  ) {}

  async categorizeTransactions(transactionIds: string[]) {
    if (transactionIds.length === 0) return;

    const [rules, categories] = await Promise.all([
      this.prisma.categorizationRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      }),
      this.prisma.category.findMany(),
    ]);
    const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));
    const outrosId = categoryIdBySlug.get(OUTROS_SLUG);

    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, categoryId: null },
      include: { account: { select: { item: { select: { userId: true } } } } },
    });

    const pendingForLlm: { index: number; id: string; description: string; amount: number }[] = [];

    for (const tx of transactions) {
      const cacheHit = tx.normalizedMerchant
        ? await this.prisma.merchantCategoryCache.findUnique({
            where: { normalizedMerchant: tx.normalizedMerchant },
          })
        : null;

      if (cacheHit) {
        await this.applyCategory(tx.id, cacheHit.categoryId, cacheHit.source, cacheHit.confidence);
        await this.bumpCacheHit(cacheHit.normalizedMerchant);
        continue;
      }

      const ruleMatch = this.matchRules(rules, tx.normalizedMerchant, tx.description);
      if (ruleMatch) {
        await this.applyCategory(tx.id, ruleMatch, 'RULE', null);
        if (tx.normalizedMerchant) {
          await this.writeCache(tx.normalizedMerchant, ruleMatch, 'RULE', null, tx.description);
        }
        continue;
      }

      const pluggySlug = tx.pluggyCategory ? PLUGGY_CATEGORY_MAP[tx.pluggyCategory] : undefined;
      const pluggyCategoryId = pluggySlug ? categoryIdBySlug.get(pluggySlug) : undefined;
      if (pluggyCategoryId) {
        await this.applyCategory(tx.id, pluggyCategoryId, 'PLUGGY', null);
        if (tx.normalizedMerchant) {
          await this.writeCache(tx.normalizedMerchant, pluggyCategoryId, 'PLUGGY', null, tx.description);
        }
        continue;
      }

      if (this.config.llmCategorizationEnabled && this.config.geminiApiKey) {
        pendingForLlm.push({
          index: pendingForLlm.length,
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
        });
      } else if (outrosId) {
        await this.applyCategory(tx.id, outrosId, 'RULE', null);
      }
    }

    for (let i = 0; i < pendingForLlm.length; i += LLM_BATCH_SIZE) {
      const batch = pendingForLlm.slice(i, i + LLM_BATCH_SIZE);
      const reindexed = batch.map((b, idx) => ({ ...b, index: idx }));
      const results = await this.gemini.classifyBatch(reindexed);

      for (const item of reindexed) {
        const result = results.find((r) => r.index === item.index);
        const categoryId = result ? categoryIdBySlug.get(result.categorySlug) : undefined;

        if (result && categoryId && result.confidence >= LLM_CONFIDENCE_THRESHOLD) {
          await this.applyCategory(item.id, categoryId, 'LLM', result.confidence);
          const tx = transactions.find((t) => t.id === item.id);
          if (tx?.normalizedMerchant) {
            await this.writeCache(tx.normalizedMerchant, categoryId, 'LLM', result.confidence, item.description);
          }
        } else if (outrosId) {
          await this.applyCategory(item.id, outrosId, 'RULE', null);
        }
      }
    }

    this.logger.log(
      `Categorizadas ${transactions.length - pendingForLlm.length} por regra/cache/pluggy, ${pendingForLlm.length} via LLM.`,
    );

    // Recorrência é calculada logo após o sync inicial, antes da categorização
    // (assíncrona) terminar — recalcula aqui para que os grupos herdem a
    // categoria correta em vez de ficarem com categoryId nulo.
    const affectedUserIds = new Set(transactions.map((t) => t.account.item.userId));
    for (const userId of affectedUserIds) {
      await this.insights.detectRecurringForUser(userId);
    }
  }

  private matchRules(
    rules: Rule[],
    normalizedMerchant: string | null,
    description: string,
  ): string | null {
    for (const rule of rules) {
      if (rule.matchType === 'MERCHANT_KEYWORD' && normalizedMerchant) {
        if (normalizedMerchant.includes(rule.pattern)) return rule.categoryId;
      }
      if (rule.matchType === 'DESCRIPTION_REGEX') {
        try {
          if (new RegExp(rule.pattern, 'i').test(description)) return rule.categoryId;
        } catch {
          // padrão inválido no seed/admin — ignora silenciosamente
        }
      }
    }
    return null;
  }

  private applyCategory(
    transactionId: string,
    categoryId: string,
    source: CategorizationSource,
    confidence: number | null,
  ) {
    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId, categorizationSource: source, categorizationConfidence: confidence },
    });
  }

  private writeCache(
    normalizedMerchant: string,
    categoryId: string,
    source: CategorizationSource,
    confidence: number | null,
    sampleDescription: string,
  ) {
    return this.prisma.merchantCategoryCache.upsert({
      where: { normalizedMerchant },
      create: { normalizedMerchant, categoryId, source, confidence, sampleDescription },
      update: { categoryId, source, confidence },
    });
  }

  private bumpCacheHit(normalizedMerchant: string) {
    return this.prisma.merchantCategoryCache.update({
      where: { normalizedMerchant },
      data: { hitCount: { increment: 1 } },
    });
  }
}
