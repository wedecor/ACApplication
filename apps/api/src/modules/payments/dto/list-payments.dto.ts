import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaymentTransactionStatus } from '@ac/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPaymentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentTransactionStatus as Record<string, string>)
  status?: PaymentTransactionStatus;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  provider?: 'razorpay' | 'stripe' | 'manual';
}
