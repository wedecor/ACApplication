import { ServiceCategory } from '@ac/types';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  CHECKLIST_ITEM_TYPES,
  CHECKLIST_KINDS,
  type ChecklistItemType,
  type ChecklistKindValue,
} from '../../domain/checklist';
import { parseBoolQuery } from '../../domain/util';

export class ChecklistItemDto {
  @ApiProperty({ example: 'gasPressurePsi' })
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_]{0,59}$/, {
    message: 'key must start with a letter and contain only letters, digits or _',
  })
  key!: string;

  @ApiProperty({ example: 'Gas pressure' })
  @IsString()
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: CHECKLIST_ITEM_TYPES })
  @IsIn(CHECKLIST_ITEM_TYPES)
  type!: ChecklistItemType;

  @ApiPropertyOptional({ example: 'psi' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  required!: boolean;
}

export class CreateChecklistTemplateDto {
  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @ApiProperty({ enum: CHECKLIST_KINDS })
  @IsIn(CHECKLIST_KINDS)
  kind!: ChecklistKindValue;

  @ApiProperty({ example: 'AC post-service checklist' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: [ChecklistItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItemDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateChecklistTemplateDto extends PartialType(CreateChecklistTemplateDto) {}

export class ListChecklistsDto {
  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional({ enum: CHECKLIST_KINDS })
  @IsOptional()
  @IsIn(CHECKLIST_KINDS)
  kind?: ChecklistKindValue;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ obj, key }) => parseBoolQuery((obj as Record<string, unknown>)[key]))
  @IsBoolean()
  active?: boolean;
}
