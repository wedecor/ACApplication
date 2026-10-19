import { PaymentMethod } from '@ac/types';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsEnum(PaymentMethod)
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
