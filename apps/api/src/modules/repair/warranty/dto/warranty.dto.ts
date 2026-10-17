import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const WARRANTY_CLAIM_TYPES = ['REPAIR_REVISIT', 'OEM_CLAIM'] as const;
export type WarrantyClaimTypeValue = (typeof WARRANTY_CLAIM_TYPES)[number];

export const WARRANTY_CLAIM_STATUSES = [
  'OPEN',
  'APPROVED',
  'REJECTED',
  'SUBMITTED_TO_OEM',
  'SETTLED',
  'CLOSED',
] as const;
export type WarrantyClaimStatusValue = (typeof WARRANTY_CLAIM_STATUSES)[number];

export class WarrantyCheckDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applianceId?: string;
}

export class ListWarrantyClaimsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WARRANTY_CLAIM_STATUSES })
  @IsOptional()
  @IsIn(WARRANTY_CLAIM_STATUSES)
  status?: WarrantyClaimStatusValue;

  @ApiPropertyOptional({ enum: WARRANTY_CLAIM_TYPES })
  @IsOptional()
  @IsIn(WARRANTY_CLAIM_TYPES)
  type?: WarrantyClaimTypeValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applianceId?: string;
}

export class CreateWarrantyClaimDto {
  @ApiProperty({ enum: WARRANTY_CLAIM_TYPES })
  @IsIn(WARRANTY_CLAIM_TYPES)
  type!: WarrantyClaimTypeValue;

  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  applianceId?: string;

  @ApiPropertyOptional({
    description: 'Booking whose repair failed. For REPAIR_REVISIT it is derived from the appliance when omitted.',
  })
  @IsOptional()
  @IsString()
  originalBookingId?: string;

  @ApiProperty({ example: 'Cooling stopped again 10 days after gas refill' })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ description: 'OEM / brand billed for OEM_CLAIM (defaults to appliance brand).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  oemName?: string;

  @ApiPropertyOptional({ description: 'Minor units.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  claimAmountMinor?: number;
}

export class DecideWarrantyClaimDto {
  @ApiProperty()
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ScheduleRevisitDto {
  @ApiProperty({ description: 'ISO timestamp for the revisit slot.' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: '10:00-12:00' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  scheduledTimeSlot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateOemClaimDto {
  @ApiProperty({ enum: ['SUBMITTED_TO_OEM', 'SETTLED'] })
  @IsIn(['SUBMITTED_TO_OEM', 'SETTLED'])
  status!: 'SUBMITTED_TO_OEM' | 'SETTLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  oemClaimRef?: string;

  @ApiPropertyOptional({ description: 'Minor units — required when settling.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  settledAmountMinor?: number;
}
