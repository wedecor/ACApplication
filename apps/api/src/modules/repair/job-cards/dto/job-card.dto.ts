import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { CHECKLIST_KINDS, type ChecklistKindValue } from '../../domain/checklist';

export const JOB_CARD_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED'] as const;
export type JobCardStatusValue = (typeof JOB_CARD_STATUSES)[number];

export class ListJobCardsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: JOB_CARD_STATUSES })
  @IsOptional()
  @IsIn(JOB_CARD_STATUSES)
  status?: JobCardStatusValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional({ description: 'Created on/after (ISO).' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Created on/before (ISO).' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ChecklistEntryDto {
  @ApiProperty()
  @IsString()
  templateId!: string;

  @ApiPropertyOptional({ enum: CHECKLIST_KINDS, description: 'Defaults to the template kind.' })
  @IsOptional()
  @IsIn(CHECKLIST_KINDS)
  kind?: ChecklistKindValue;

  @ApiProperty({ type: Object, example: { gasPressurePsi: 65, filterCleaned: true } })
  @IsObject()
  answers!: Record<string, unknown>;
}

/** Partial upsert body — only provided fields are written. */
export class UpsertJobCardDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Fault code values, e.g. ["E4","F0"].' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  faultCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnosis?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  rootCause?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resolution?: string | null;

  @ApiPropertyOptional({
    type: Object,
    description: 'Measured values; shallow-merged into existing readings.',
    example: { gasPressurePsi: 65, currentAmps: 4.2, voltage: 228 },
  })
  @IsOptional()
  @IsObject()
  readings?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: [ChecklistEntryDto],
    description: 'Merged per templateId; answers are shallow-merged.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChecklistEntryDto)
  checklist?: ChecklistEntryDto[];

  @ApiPropertyOptional({
    type: [Object],
    description: 'Parts the technician recommends, e.g. [{ name, sku?, qty, unitPriceMinor? }]. Replaces the list.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  partsRecommended?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: [String], description: 'Photo URLs. Replaces the list.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  // http(s) only: these links are opened by staff in the admin CRM.
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false }, { each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  technicianRemarks?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customerRemarks?: string | null;
}

export class CompleteJobCardDto {
  @ApiPropertyOptional({
    description: 'Defaults to true unless the booking went through WAITING_PARTS.',
  })
  @IsOptional()
  @IsBoolean()
  firstTimeFix?: boolean;
}
