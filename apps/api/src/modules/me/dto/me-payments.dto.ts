import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PayMyInvoiceDto {
  @ApiProperty({ enum: ['razorpay', 'stripe'] })
  @IsIn(['razorpay', 'stripe'])
  gateway!: 'razorpay' | 'stripe';

  @ApiPropertyOptional({ description: 'Saved payment method id (gateway token reference only).' })
  @IsOptional()
  @IsString()
  methodId?: string;
}

export class ConfirmMyInvoicePaymentDto {
  @ApiPropertyOptional({ enum: ['razorpay', 'stripe'] })
  @IsOptional()
  @IsIn(['razorpay', 'stripe'])
  gateway?: 'razorpay' | 'stripe';

  @ApiPropertyOptional({ description: 'Redirect URL the hosted checkout returned to.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class InvoicePdfQueryDto {
  @ApiProperty()
  @IsString()
  t!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  exp!: number;

  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/)
  sig!: string;
}
