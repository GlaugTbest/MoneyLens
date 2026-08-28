import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PluggyService } from './pluggy.service';

@Module({
  imports: [HttpModule],
  providers: [PluggyService],
  exports: [PluggyService],
})
export class PluggyModule {}
