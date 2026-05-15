import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadPriority, LeadSource, LeadStatus } from '@ac/types';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * Query parameters for listing leads. Comma-separated values for arrays
 * (e.g. `?status=NEW,CONTACTED`) — handled by the @Transform decorator so
 * the controller never has to parse strings.
 */
export class ListLeadsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeadStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(LeadStatus, { each: true })
  status?: LeadStatus[];

  @ApiPropertyOptional({ enum: LeadSource, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(LeadSource, { each: true })
  source?: LeadSource[];

  @ApiPropertyOptional({ enum: LeadPriority, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(LeadPriority, { each: true })
  priority?: LeadPriority[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional({ description: 'ISO date — lower bound on createdAt.' })
  @IsOptional()
  @IsISO8601()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — upper bound on createdAt.' })
  @IsOptional()
  @IsISO8601()
  createdTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 'createdAt:desc', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  sort?: string;
}

function toArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}
