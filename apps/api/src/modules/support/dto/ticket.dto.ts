import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ConversationChannel, TicketPriority, TicketSource, TicketStatus } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateTicketDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  anonymousIdentifier?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  amcSubscriptionId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketSource)
  source?: TicketSource;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  assignedTeam?: string;

  @IsOptional()
  @IsString()
  slaProfileId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subcategory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional()
  @IsString()
  slaProfileId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListTicketsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TicketStatus, { each: true })
  @IsArray()
  status?: TicketStatus[];

  @IsOptional()
  @IsEnum(TicketPriority, { each: true })
  @IsArray()
  priority?: TicketPriority[];

  @IsOptional()
  @IsEnum(TicketSource, { each: true })
  @IsArray()
  source?: TicketSource[];

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  assignedTeam?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @ApiPropertyOptional({ description: 'Filter to overdue tickets only.' })
  @IsString()
  overdue?: 'true' | 'false';

  @IsOptional()
  @IsString()
  tag?: string;
}

export class AssignTicketDto {
  @IsString()
  assignedAgentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  team?: string;
}

export class ChangeStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class EscalateTicketDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  level?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  assignToUserId?: string;
}

export class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean = true;
}

export class ReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsEnum(ConversationChannel)
  channel!: ConversationChannel;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateName?: string;

  @IsOptional()
  @IsObject()
  templateData?: Record<string, unknown>;
}

export class CsatDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class MergeTicketDto {
  @IsString()
  targetTicketId!: string;
}

export class AttachmentDto {
  @IsString()
  storageKey!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  kind?: string;
}

export class AddAttachmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments!: AttachmentDto[];

  @IsOptional()
  @IsString()
  messageId?: string;
}
