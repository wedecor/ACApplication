import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export const TASK_ENTITY_TYPES = [
  'lead',
  'customer',
  'booking',
  'ticket',
  'opportunity',
  'account',
] as const;
export type TaskEntityType = (typeof TASK_ENTITY_TYPES)[number];

export class ListTasksDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['mine', 'all'], default: 'mine' })
  @IsOptional()
  @IsIn(['mine', 'all'])
  scope?: 'mine' | 'all';

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ enum: TASK_ENTITY_TYPES })
  @IsOptional()
  @IsIn(TASK_ENTITY_TYPES)
  entityType?: TaskEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  dueAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  reminderAt?: string | null;

  @ApiPropertyOptional({ description: 'Defaults to the caller.' })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional({ enum: TASK_ENTITY_TYPES })
  @IsOptional()
  @IsIn(TASK_ENTITY_TYPES)
  entityType?: TaskEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
