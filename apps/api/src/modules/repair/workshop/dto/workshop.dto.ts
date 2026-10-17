import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { WORKSHOP_STATUSES, type WorkshopStatus } from '../../domain/workshop-state';

function toArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}

export class ListWorkshopJobsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: WORKSHOP_STATUSES,
    isArray: true,
    description: 'One status or a comma-separated list.',
  })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsIn(WORKSHOP_STATUSES, { each: true })
  status?: WorkshopStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class CreateWorkshopJobDto {
  @ApiProperty()
  @IsString()
  bookingId!: string;

  @ApiPropertyOptional({ description: 'Workshop location (Warehouse id).' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  pickupScheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  estimatedReadyAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class TransitionWorkshopJobDto {
  @ApiProperty({ enum: WORKSHOP_STATUSES })
  @IsIn(WORKSHOP_STATUSES)
  status!: WorkshopStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: 'Front panel scratched, remote missing' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionOnReceipt?: string;

  @ApiPropertyOptional({ type: [String], example: ['Remote', 'Stand'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  accessoriesReceived?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Photo URLs appended to the job.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ description: 'Update the ETA while transitioning.' })
  @IsOptional()
  @IsISO8601()
  estimatedReadyAt?: string;
}
