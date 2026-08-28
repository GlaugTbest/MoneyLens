import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Opcional — se ausente, usa o cookie httpOnly' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
