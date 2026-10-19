import { InvoiceStatus } from '@ac/types';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListInvoicesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
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
