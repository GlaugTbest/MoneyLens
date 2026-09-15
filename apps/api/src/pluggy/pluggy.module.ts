import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PluggyService } from './pluggy.service';

@Module({
  imports: [HttpModule.register({ timeout: 20_000, maxRedirects: 0 })],
  providers: [PluggyService],
  exports: [PluggyService],
})
export class PluggyModule {}
