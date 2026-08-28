import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConnectTokenDto {
  @ApiPropertyOptional({ description: 'Item existente, para fluxo de reconexão/atualização' })
  @IsOptional()
  @IsString()
  itemId?: string;
}
