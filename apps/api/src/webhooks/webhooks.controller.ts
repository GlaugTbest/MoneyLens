import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { Public } from '../common/decorators/public.decorator';
import { WEBHOOKS_QUEUE, WEBHOOK_PROCESS_JOB } from '../queue/queue.constants';

interface PluggyWebhookPayload {
  event: string;
  eventId: string;
  itemId?: string;
  clientUserId?: string;
  transactionIds?: string[];
  [key: string]: unknown;
}

// Endpoint público chamado pelo Pluggy. O Pluggy não assina os payloads por
// padrão, então a autenticação é feita via um header customizado, registrado
// junto com a URL do webhook (POST /webhooks -> { headers: {...} }).
@ApiExcludeController()
@Controller('api/webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @InjectQueue(WEBHOOKS_QUEUE) private readonly webhooksQueue: Queue,
  ) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('pluggy')
  async handlePluggyWebhook(
    @Body() payload: PluggyWebhookPayload,
    @Headers('x-webhook-secret') secretHeader: string | undefined,
  ) {
    // Em produção, PLUGGY_WEBHOOK_SECRET é obrigatório (validado no boot — ver
    // env.validation.ts), então esse fallback só existe para dev local sem
    // segredo configurado; qualquer segredo configurado precisa bater exato.
    const expectedSecret = this.config.pluggyWebhookSecret;
    const signatureValid = expectedSecret
      ? secretHeader === expectedSecret
      : this.config.nodeEnv !== 'production';

    // O itemId pode se referir a um Item que ainda não existe localmente
    // (ex.: webhook chegou antes do POST /api/connections concluir) — nesse
    // caso guardamos o evento sem a FK, mas o itemId original continua no
    // payload bruto para depuração.
    const knownItem = payload.itemId
      ? await this.prisma.item.findUnique({ where: { id: payload.itemId } })
      : null;

    const event = await this.prisma.webhookEvent.create({
      data: {
        itemId: knownItem?.id ?? null,
        eventType: payload.event,
        payload: payload as unknown as object,
        signatureValid,
      },
    });

    if (!signatureValid) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', error: 'Assinatura/segredo inválido' },
      });
      throw new UnauthorizedException();
    }

    // Handler fica intencionalmente rápido: persiste e enfileira, o
    // processamento de fato acontece no worker.
    await this.webhooksQueue.add(WEBHOOK_PROCESS_JOB, { webhookEventId: event.id });

    return { received: true };
  }
}
