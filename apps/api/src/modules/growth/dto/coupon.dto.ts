import { ServiceCategory } from '@ac/types';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateCouponDto {
  @ApiProperty({ example: 'WELCOME100' })
  @IsString()
  @Length(3, 32)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'code may contain letters, digits, - and _ only' })
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ['PERCENT', 'FLAT'] })
  @IsIn(['PERCENT', 'FLAT'])
  discountType!: 'PERCENT' | 'FLAT';

  @ApiProperty({ description: 'PERCENT: basis points (1000 = 10%). FLAT: minor units.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  discountValue!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDiscountMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ default: 1, description: '0 = unlimited per customer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  perCustomerLimit?: number;

  @ApiPropertyOptional({ enum: Object.values(ServiceCategory), isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ServiceCategory, { each: true })
  categories?: ServiceCategory[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  firstBookingOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ListCouponsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}

export class ValidateCouponDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  code!: string;

  @ApiPropertyOptional({ enum: Object.values(ServiceCategory) })
  @IsOptional()
  @IsEnum(ServiceCategory)
  category?: ServiceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMinor?: number;
}

export class AdminValidateCouponDto extends ValidateCouponDto {
  @ApiProperty()
  @IsString()
  customerId!: string;
}
