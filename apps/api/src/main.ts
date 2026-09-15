import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);

  // Railway (e a maioria dos PaaS) termina TLS e faz proxy pro container por
  // HTTP puro. Sem isso, req.ip vê o IP do proxy pra todo mundo — o rate
  // limiting por IP trataria todos os usuários como um único cliente.
  app.set('trust proxy', 1);

  // A API não serve HTML própria (o frontend é um app separado), então CSP
  // pode ficar restritiva; os demais headers do helmet (X-Frame-Options,
  // X-Content-Type-Options, HSTS quando atrás de HTTPS, etc.) valem por si.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
    }),
  );
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  if (config.nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MoneyLens API')
      .setDescription('API do MoneyLens — conexões Open Finance, transações e insights')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Railway (e a maioria dos PaaS) injeta a porta a escutar via $PORT —
  // prevalece sobre API_PORT quando presente.
  await app.listen(process.env.PORT ? Number(process.env.PORT) : config.apiPort);
}

bootstrap();
