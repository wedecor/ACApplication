import { IsBoolean, IsOptional } from 'class-validator';

export class SendInvoiceDto {
  /** Send via WhatsApp (default true). */
  @IsOptional()
  @IsBoolean()
  whatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}
