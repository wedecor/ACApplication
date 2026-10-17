import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CUSTOM_FIELD_ENTITIES = ['customer', 'lead', 'booking', 'appliance'] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export class ListCustomFieldsDto {
  @ApiPropertyOptional({ enum: CUSTOM_FIELD_ENTITIES })
  @IsOptional()
  @IsIn(CUSTOM_FIELD_ENTITIES)
  entity?: CustomFieldEntity;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateCustomFieldDto {
  @ApiProperty({ enum: CUSTOM_FIELD_ENTITIES })
  @IsIn(CUSTOM_FIELD_ENTITIES)
  entity!: CustomFieldEntity;

  @ApiProperty({ description: 'snake_case key, e.g. "society_block".' })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,49}$/, { message: 'key must be snake_case (a-z, 0-9, _)' })
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @ApiProperty({ enum: CUSTOM_FIELD_TYPES })
  @IsIn(CUSTOM_FIELD_TYPES)
  fieldType!: CustomFieldType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateCustomFieldDto extends PartialType(
  OmitType(CreateCustomFieldDto, ['entity', 'key'] as const),
) {}
