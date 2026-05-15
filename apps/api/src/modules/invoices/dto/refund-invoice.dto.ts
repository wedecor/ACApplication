import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RefundInvoiceDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /**
   * When true (default) a customer-facing credit note is generated and
   * applied to the invoice. Set false for off-platform / cash refunds
   * where the ops team doesn't want a credit document.
   */
  @IsOptional()
  issueCreditNote?: boolean;
}
