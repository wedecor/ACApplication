import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({ minimum: 1, description: 'Amount to refund in minor units (paise).' })
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Issue a credit note against the invoice (default true).' })
  @IsOptional()
  @IsBoolean()
  issueCreditNote?: boolean;
}
