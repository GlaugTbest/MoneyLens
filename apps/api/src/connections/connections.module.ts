import { Module } from '@nestjs/common';
import { PluggyModule } from '../pluggy/pluggy.module';
import { SyncModule } from '../sync/sync.module';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';

@Module({
  imports: [PluggyModule, SyncModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
