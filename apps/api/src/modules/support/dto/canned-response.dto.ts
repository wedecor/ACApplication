import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { CannedResponseScope, ConversationChannel } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateCannedResponseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsEnum(CannedResponseScope)
  scope?: CannedResponseScope;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  team?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ConversationChannel, { each: true })
  channels?: ConversationChannel[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCannedResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsEnum(CannedResponseScope)
  scope?: CannedResponseScope;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  team?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ConversationChannel, { each: true })
  channels?: ConversationChannel[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListCannedResponsesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CannedResponseScope)
  scope?: CannedResponseScope;

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsEnum(ConversationChannel)
  channel?: ConversationChannel;

  @IsOptional()
  @IsString()
  tag?: string;
}
