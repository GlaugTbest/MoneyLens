import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller('api/health')
export class HealthController {
  @Public()
  @Get()
  live() {
    // Liveness only; successful responses do not imply external services are healthy.
    return { status: 'ok', mode: 'sandbox-mvp' };
  }
}
