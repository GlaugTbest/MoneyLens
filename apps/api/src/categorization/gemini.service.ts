import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../config/config.service';

export interface GeminiClassificationInput {
  index: number;
  description: string;
  amount: number;
}

export interface GeminiClassificationResult {
  index: number;
  categorySlug: string;
  confidence: number;
}

const CATEGORY_SLUGS = [
  'alimentacao',
  'transporte',
  'assinaturas',
  'moradia',
  'lazer',
  'saude',
  'compras',
  'receita',
  'transferencias',
  'taxas',
  'outros',
];

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: AppConfigService,
  ) {}

  async classifyBatch(items: GeminiClassificationInput[]): Promise<GeminiClassificationResult[]> {
    if (items.length === 0) return [];

    const prompt = this.buildPrompt(items);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.geminiModel}:generateContent`;

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0 },
          },
          { params: { key: this.config.geminiApiKey } },
        ),
      );

      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
      const parsed = JSON.parse(text) as Array<{
        index: number;
        category: string;
        confidence: number;
      }>;

      return parsed
        .filter((p) => CATEGORY_SLUGS.includes(p.category))
        .map((p) => ({ index: p.index, categorySlug: p.category, confidence: p.confidence }));
    } catch (err) {
      this.logger.error('Falha ao classificar via Gemini', err as Error);
      return [];
    }
  }

  private buildPrompt(items: GeminiClassificationInput[]): string {
    return [
      'Você é um categorizador de transações financeiras de um app de finanças pessoais brasileiro.',
      `Classifique cada transação em exatamente uma destas categorias: ${CATEGORY_SLUGS.join(', ')}.`,
      'Responda APENAS com um array JSON no formato [{"index": number, "category": string, "confidence": number entre 0 e 1}].',
      'Use "outros" quando não tiver certeza razoável.',
      '',
      'Transações:',
      JSON.stringify(
        items.map((i) => ({ index: i.index, description: i.description, amount: i.amount })),
      ),
    ].join('\n');
  }
}
