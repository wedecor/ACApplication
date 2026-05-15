import { IsEnum, IsOptional, IsString } from 'class-validator';

import { QuotationStatus } from '@ac/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListQuotationsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(QuotationStatus as Record<string, string>)
  status?: QuotationStatus;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
