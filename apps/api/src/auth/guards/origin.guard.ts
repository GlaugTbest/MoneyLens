import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method: string; headers: { origin?: string } }>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    // Browsers supply Origin on mutations. CLI clients/webhooks still require their own authentication.
    if (request.headers.origin && request.headers.origin !== this.config.corsOrigin) {
      throw new ForbiddenException('Origem da requisição não permitida');
    }
    return true;
  }
}
