import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class SpendEvolutionQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'month' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy: 'day' | 'week' | 'month' = 'month';

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class PeriodQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class MonthQueryDto {
  @ApiPropertyOptional({ description: 'Qualquer data dentro do mês desejado (default: hoje)' })
  @IsOptional()
  @IsISO8601()
  month?: string;
}
