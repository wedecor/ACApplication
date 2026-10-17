import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const FIELD_PAYMENT_METHODS = ['CASH', 'UPI', 'CARD'] as const;
export type FieldPaymentMethod = (typeof FIELD_PAYMENT_METHODS)[number];

export class RecordFieldPaymentDto {
  @ApiProperty({ enum: FIELD_PAYMENT_METHODS })
  @IsIn(FIELD_PAYMENT_METHODS)
  method!: FieldPaymentMethod;

  @ApiProperty({ description: 'Minor units (paise). Must not exceed the amount due.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @ApiPropertyOptional({ description: 'UPI transaction id / card slip number.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}
