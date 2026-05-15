import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { AMCPlanType, ServiceCategory } from '@ac/types';

export class CreateAmcPlanDto {
  @IsString()
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(AMCPlanType as Record<string, string>)
  type!: AMCPlanType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  durationMonths!: number;

  @IsInt()
  @Min(1)
  includedVisits!: number;

  @IsOptional()
  @IsBoolean()
  emergencySupport?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountBps?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ServiceCategory as Record<string, string>, { each: true })
  appliancesCovered!: ServiceCategory[];

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  renewalPriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  visitCadenceDays?: number;

  @IsOptional()
  @IsArray()
  features?: string[];
}

export class UpdateAmcPlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsInt() @Min(0) renewalPriceMinor?: number;
  @IsOptional() @IsInt() @Min(0) discountBps?: number;
  @IsOptional() @IsArray() features?: string[];
}

export class CreateAmcSubscriptionDto {
  @IsString()
  customerId!: string;

  @IsString()
  planId!: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => String)
  @IsArray()
  @IsString({ each: true })
  appliancesSnapshot?: ServiceCategory[];

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
