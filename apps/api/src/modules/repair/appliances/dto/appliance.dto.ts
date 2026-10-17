import { ServiceCategory } from '@ac/types';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class CreateApplianceDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Customer address where the unit is installed.' })
  @IsOptional()
  @IsString()
  addressId?: string | null;

  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @ApiProperty({ example: 'Daikin' })
  @IsString()
  @MaxLength(80)
  brand!: string;

  @ApiPropertyOptional({ example: 'FTKF50TV16U' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string | null;

  @ApiPropertyOptional({ example: '1.5 ton' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  capacity?: string | null;

  @ApiPropertyOptional({ example: 'Master bedroom' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  installedLocation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  purchaseDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  installDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  manufacturerWarrantyUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  extendedWarrantyUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  warrantyProvider?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  purchaseInvoiceUrl?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateApplianceDto extends PartialType(
  OmitType(CreateApplianceDto, ['customerId'] as const),
) {}

export class ListAppliancesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({ description: 'Exact (case-insensitive) serial number match.' })
  @IsOptional()
  @IsString()
  serial?: string;

  @ApiPropertyOptional({ description: 'Free-text search: brand, model, serial, customer name/phone.' })
  @IsOptional()
  @IsString()
  q?: string;
}
