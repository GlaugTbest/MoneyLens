import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { Public } from '../common/decorators/public.decorator';
import { WEBHOOKS_QUEUE, WEBHOOK_PROCESS_JOB } from '../queue/queue.constants';

const webhookSchema = z.object({
  event: z.string().min(1).max(100),
  eventId: z.string().min(1).max(200),
  itemId: z.string().min(1).max(200).optional(),
  transactionIds: z.array(z.string().min(1).max(200)).max(1000).optional(),
}).passthrough();

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
    @Body() body: unknown,
    @Headers('x-webhook-secret') secretHeader: string | undefined,
  ) {
    const expected = this.config.pluggyWebhookSecret;
    const signatureValid = expected
      ? Boolean(secretHeader && Buffer.byteLength(secretHeader) === Buffer.byteLength(expected)
          && timingSafeEqual(Buffer.from(secretHeader), Buffer.from(expected)))
      : this.config.nodeEnv !== 'production';
    if (!signatureValid) throw new UnauthorizedException();

    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Payload de webhook inválido');
    const payload = parsed.data;
    const knownItem = payload.itemId
      ? await this.prisma.item.findUnique({ where: { id: payload.itemId } })
      : null;
    const event = await this.prisma.webhookEvent.upsert({
      where: { externalEventId: payload.eventId },
      create: {
        externalEventId: payload.eventId,
        itemId: knownItem?.id ?? null,
        eventType: payload.event,
        payload: payload as object,
        signatureValid: true,
      },
      update: {},
    });
    if (event.status !== 'PROCESSED') {
      // A retry after a Redis outage finds the same durable event and queues it again.
      await this.webhooksQueue.add(WEBHOOK_PROCESS_JOB, { webhookEventId: event.id }, {
        deduplication: { id: event.id },
      });
    }
    return { received: true };
  }
}
