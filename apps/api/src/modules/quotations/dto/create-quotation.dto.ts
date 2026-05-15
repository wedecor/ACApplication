import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateInvoiceLineItemDto } from '../../invoices/dto/create-invoice.dto';

export class CreateQuotationDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems!: CreateInvoiceLineItemDto[];

  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  placeOfSupply?: string;

  /** Default 7 days from creation if omitted. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;
}
