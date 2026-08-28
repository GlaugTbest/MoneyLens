import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RegisterConnectionDto {
  @ApiProperty()
  @IsString()
  itemId!: string;
}
