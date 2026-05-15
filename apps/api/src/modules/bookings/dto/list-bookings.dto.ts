import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingPaymentStatus, BookingPriority, BookingStatus, ServiceCategory } from '@ac/types';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListBookingsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BookingStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(BookingStatus, { each: true })
  status?: BookingStatus[];

  @ApiPropertyOptional({ enum: BookingPaymentStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(BookingPaymentStatus, { each: true })
  paymentStatus?: BookingPaymentStatus[];

  @ApiPropertyOptional({ enum: BookingPriority, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(BookingPriority, { each: true })
  priority?: BookingPriority[];

  @ApiPropertyOptional({ enum: ServiceCategory, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(ServiceCategory, { each: true })
  category?: ServiceCategory[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledTo?: string;

  @ApiPropertyOptional({ default: 'scheduledAt:asc' })
  @IsOptional()
  @IsString()
  sort?: string;
}

function toArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}
