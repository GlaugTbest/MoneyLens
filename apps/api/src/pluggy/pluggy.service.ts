import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { AppConfigService } from '../config/config.service';
import {
  PluggyAccountsResponse,
  PluggyItem,
  PluggyTransactionsPage,
} from './pluggy.types';

const API_KEY_SAFETY_MARGIN_MS = 5 * 60 * 1000;

@Injectable()
export class PluggyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluggyService.name);
  private cachedApiKey: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: AppConfigService,
  ) {}

  async onApplicationBootstrap() {
    const url = this.config.pluggyWebhookUrl;
    if (!url || url.includes('<your-ngrok-subdomain>')) {
      this.logger.warn(
        'PLUGGY_WEBHOOK_URL não configurada (ou ainda é o placeholder) — pulando registro de webhook.',
      );
      return;
    }
    try {
      await this.ensureWebhookRegistered(url, this.config.pluggyWebhookSecret);
    } catch (err) {
      this.logger.error('Falha ao registrar webhook do Pluggy no startup', err as Error);
    }
  }

  private async getApiKey(): Promise<string> {
    if (this.cachedApiKey && this.cachedApiKey.expiresAt > Date.now()) {
      return this.cachedApiKey.value;
    }

    const { data } = await firstValueFrom(
      this.http.post<{ apiKey: string }>(`${this.config.pluggyBaseUrl}/auth`, {
        clientId: this.config.pluggyClientId,
        clientSecret: this.config.pluggyClientSecret,
      }),
    );

    // Pluggy API keys are valid for 2h; refresh a bit early to avoid edge races.
    this.cachedApiKey = {
      value: data.apiKey,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000 - API_KEY_SAFETY_MARGIN_MS,
    };
    return data.apiKey;
  }

  private async headers() {
    const apiKey = await this.getApiKey();
    return { 'X-API-KEY': apiKey };
  }

  async createConnectToken(options: { itemId?: string; clientUserId: string }): Promise<string> {
    const body: Record<string, unknown> = { options: { clientUserId: options.clientUserId } };
    if (options.itemId) body.itemId = options.itemId;

    const { data } = await firstValueFrom(
      this.http.post<{ accessToken: string }>(
        `${this.config.pluggyBaseUrl}/connect_token`,
        body,
        { headers: await this.headers() },
      ),
    );
    return data.accessToken;
  }

  async getItem(itemId: string): Promise<PluggyItem> {
    const { data } = await firstValueFrom(
      this.http.get<PluggyItem>(`${this.config.pluggyBaseUrl}/items/${itemId}`, {
        headers: await this.headers(),
      }),
    );
    return data;
  }

  async deleteItem(itemId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.config.pluggyBaseUrl}/items/${itemId}`, {
        headers: await this.headers(),
      }),
    ).catch((err: AxiosError) => {
      if (err.response?.status !== 404) throw err;
    });
  }

  async listAccounts(itemId: string): Promise<PluggyAccountsResponse> {
    const { data } = await firstValueFrom(
      this.http.get<PluggyAccountsResponse>(`${this.config.pluggyBaseUrl}/accounts`, {
        params: { itemId },
        headers: await this.headers(),
      }),
    );
    return data;
  }

  // /v2/transactions uses cursor-based pagination (`next`), not page/pageSize —
  // the legacy /transactions endpoint is deprecated (HTTP 410).
  async listTransactionsPage(
    accountId: string,
    cursor?: string,
  ): Promise<PluggyTransactionsPage> {
    const { data } = await firstValueFrom(
      this.http.get<PluggyTransactionsPage>(`${this.config.pluggyBaseUrl}/v2/transactions`, {
        params: { accountId, ...(cursor ? { cursor } : {}) },
        headers: await this.headers(),
      }),
    );
    return data;
  }

  async *listAllTransactions(accountId: string) {
    let cursor: string | undefined;
    do {
      const page = await this.listTransactionsPage(accountId, cursor);
      yield page.results;
      cursor = page.next ?? undefined;
    } while (cursor);
  }

  // Idempotent: Pluggy returns 400 if a webhook for this event+url already
  // exists, which we treat as success.
  async ensureWebhookRegistered(url: string, secret?: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.config.pluggyBaseUrl}/webhooks`,
          {
            event: 'all',
            url,
            ...(secret ? { headers: { 'X-Webhook-Secret': secret } } : {}),
          },
          { headers: await this.headers() },
        ),
      );
      this.logger.log(`Webhook registrado: ${url}`);
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      const message = (err as AxiosError<{ message?: string }>).response?.data?.message ?? '';
      if (status === 400 && message.includes('already exists')) {
        this.logger.log('Webhook já registrado, ignorando.');
        return;
      }
      throw err;
    }
  }
}
