import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePaymentLinkDto {
  @IsString()
  invoiceId!: string;

  /** Defaults to invoice.dueAmountMinor when omitted. */
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  /** "razorpay" | "stripe" — defaults to env-preferred. */
  @IsOptional()
  @IsString()
  provider?: 'razorpay' | 'stripe';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
