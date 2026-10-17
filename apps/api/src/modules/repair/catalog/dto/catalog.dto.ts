import { ServiceCategory } from '@ac/types';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { parseBoolQuery } from '../../domain/util';

export class CreateCatalogItemDto {
  @ApiProperty({ example: 'AC-GAS-REFILL' })
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,49}$/, {
    message: 'code must be 2-50 chars of A-Z, 0-9, _ or -',
  })
  code!: string;

  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @ApiProperty({ example: 'AC gas refill (R32)' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Minor units (paise).', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePriceMinor?: number;

  @ApiPropertyOptional({ description: 'Minor units (paise).', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  visitChargeMinor?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(24 * 60)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  repairWarrantyDays?: number;

  @ApiPropertyOptional({ description: 'GST rate in basis points (1800 = 18%).', default: 1800 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  gstRateBps?: number;

  @ApiPropertyOptional({ example: '998719' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sacCode?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateCatalogItemDto extends PartialType(CreateCatalogItemDto) {}

export class ListCatalogDto {
  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({ description: 'true/false — omit for all.' })
  @IsOptional()
  @Transform(({ obj, key }) => parseBoolQuery((obj as Record<string, unknown>)[key]))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
