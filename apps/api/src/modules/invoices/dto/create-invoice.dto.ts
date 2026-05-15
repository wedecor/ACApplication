import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceLineItemDto {
  @IsString()
  @MaxLength(255)
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitPriceMinor!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountMinor?: number;

  /** Basis points: 1800 = 18 %. */
  @IsOptional()
  @IsInt()
  @Min(0)
  taxRateBps?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsnSacCode?: string;
}

export class CreateInvoiceDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  amcSubscriptionId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems!: CreateInvoiceLineItemDto[];

  /** Invoice-level discount in minor units, applied AFTER line tax. */
  @IsOptional()
  @IsInt()
  @Min(0)
  discountMinor?: number;

  @IsOptional()
  @IsBoolean()
  gstEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gstNumber?: string;

  /** 2-letter Indian state code for place-of-supply (e.g. "KA"). */
  @IsOptional()
  @IsString()
  @MaxLength(2)
  placeOfSupply?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
