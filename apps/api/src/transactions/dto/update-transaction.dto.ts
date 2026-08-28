import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateTransactionDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;
}
