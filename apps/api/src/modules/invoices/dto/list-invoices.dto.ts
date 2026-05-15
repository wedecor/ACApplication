import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { InvoiceStatus } from '@ac/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListInvoicesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(InvoiceStatus as Record<string, string>)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  /** Free-text — searches `number` and `notes`. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDueAmountMinor?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  overdueOnly?: boolean;
}
