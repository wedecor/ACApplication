import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { PaymentMethod } from '@ac/types';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsEnum(PaymentMethod as Record<string, string>)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gatewayRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
