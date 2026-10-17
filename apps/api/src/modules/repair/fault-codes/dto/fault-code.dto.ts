import { ServiceCategory } from '@ac/types';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { parseBoolQuery } from '../../domain/util';

export class CreateFaultCodeDto {
  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @ApiPropertyOptional({ description: 'Null / omitted = applies to every brand.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @ApiProperty({ example: 'E4' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Low refrigerant / gas leak' })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  suggestedFix?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFaultCodeDto extends PartialType(CreateFaultCodeDto) {}

export class ListFaultCodesDto {
  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({ description: 'Returns brand-specific codes plus generic (brand-less) ones.' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ obj, key }) => parseBoolQuery((obj as Record<string, unknown>)[key]))
  @IsBoolean()
  active?: boolean;
}
