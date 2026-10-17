import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  ConversationChannel,
  ConversationStatus,
  MessageDirection,
} from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { toArray } from '../../../common/dto/query-transforms';

export class ListConversationsDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsEnum(ConversationChannel, { each: true })
  @IsArray()
  channel?: ConversationChannel[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsEnum(ConversationStatus, { each: true })
  @IsArray()
  status?: ConversationStatus[];

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  unread?: 'true' | 'false';
}

export class AssignConversationDto {
  @IsString()
  assignedAgentId!: string;
}

export class SendConversationMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsEnum(ConversationChannel)
  channel!: ConversationChannel;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateName?: string;

  @IsOptional()
  @IsObject()
  templateData?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  asInternalNote?: boolean;
}

export class TypingIndicatorDto {
  @IsBoolean()
  isTyping!: boolean;
}

export class MarkReadDto {
  @IsOptional()
  @IsString()
  lastMessageId?: string;
}

export class ListMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsEnum(MessageDirection)
  direction?: MessageDirection;
}
