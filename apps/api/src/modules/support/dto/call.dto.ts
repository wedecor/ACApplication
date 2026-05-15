import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CallDirection, CallDisposition, CallStatus } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class StartCallDto {
  @IsEnum(CallDirection)
  direction!: CallDirection;

  @IsString()
  @MinLength(4)
  @MaxLength(32)
  fromNumber!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(32)
  toNumber!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  agentUserId?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  externalCallId?: string;

  @IsOptional()
  @IsString()
  queue?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCallStatusDto {
  @IsEnum(CallStatus)
  status!: CallStatus;

  @IsOptional()
  @IsString()
  agentUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationS?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CallDispositionDto {
  @IsEnum(CallDisposition)
  disposition!: CallDisposition;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  followupTicketId?: string;
}

export class ClickToCallDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  toNumber!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}

export class AddRecordingDto {
  @IsString()
  storageKey!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  language?: string;
}

export class ListCallsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CallStatus, { each: true })
  @IsArray()
  status?: CallStatus[];

  @IsOptional()
  @IsEnum(CallDirection)
  direction?: CallDirection;

  @IsOptional()
  @IsString()
  agentUserId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsEnum(CallDisposition, { each: true })
  @IsArray()
  disposition?: CallDisposition[];

  @IsOptional()
  @IsString()
  missed?: 'true' | 'false';
}
