import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv() {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get apiPort() {
    return this.config.get('API_PORT', { infer: true });
  }

  get corsOrigin() {
    return this.config.get('CORS_ORIGIN', { infer: true });
  }

  get databaseUrl() {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get redisUrl() {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get redisConnection() {
    const url = new URL(this.redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
    };
  }

  get jwtAccessSecret() {
    return this.config.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret() {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwtAccessExpiresIn() {
    return this.config.get('JWT_ACCESS_EXPIRES_IN', { infer: true });
  }

  get jwtRefreshExpiresIn() {
    return this.config.get('JWT_REFRESH_EXPIRES_IN', { infer: true });
  }

  get pluggyClientId() {
    return this.config.get('PLUGGY_CLIENT_ID', { infer: true });
  }

  get pluggyClientSecret() {
    return this.config.get('PLUGGY_CLIENT_SECRET', { infer: true });
  }

  get pluggyBaseUrl() {
    return this.config.get('PLUGGY_BASE_URL', { infer: true });
  }

  get pluggyWebhookUrl() {
    return this.config.get('PLUGGY_WEBHOOK_URL', { infer: true });
  }

  get pluggyWebhookSecret() {
    return this.config.get('PLUGGY_WEBHOOK_SECRET', { infer: true });
  }

  get geminiApiKey() {
    return this.config.get('GEMINI_API_KEY', { infer: true });
  }

  get geminiModel() {
    return this.config.get('GEMINI_MODEL', { infer: true });
  }

  get llmCategorizationEnabled() {
    return this.config.get('ENABLE_LLM_CATEGORIZATION', { infer: true });
  }
}
