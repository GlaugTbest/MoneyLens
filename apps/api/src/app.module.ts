import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PluggyModule } from './pluggy/pluggy.module';
import { ConnectionsModule } from './connections/connections.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { SyncModule } from './sync/sync.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CategorizationModule } from './categorization/categorization.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    // Baseline global — rotas sensíveis (auth, connect-token) definem limites
    // mais estritos via @Throttle() no próprio controller.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: config.redisConnection,
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    PluggyModule,
    ConnectionsModule,
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
    SyncModule,
    WebhooksModule,
    CategorizationModule,
    InsightsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
