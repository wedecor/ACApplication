import { NotificationChannel } from '@ac/types';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

// ------------------------------------------------------------------ segments

export class SegmentRulesBodyDto {
  @ApiProperty({
    description:
      '{ cityIds?, tags?, categories?, minBookings?, maxBookings?, lastBookingBeforeDays?, amcStatus?: active|expired|none, applianceWarrantyExpiringInDays? }',
  })
  @IsObject()
  rules!: Record<string, unknown>;
}

export class CreateSegmentDto extends SegmentRulesBodyDto {
  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSegmentDto extends PartialType(CreateSegmentDto) {}

// ----------------------------------------------------------------- campaigns

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  segmentId?: string;

  @ApiProperty({ enum: Object.values(NotificationChannel) })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ example: 'growth.campaign' })
  @IsString()
  @Length(2, 120)
  templateKey!: string;

  @ApiPropertyOptional({ description: 'Free-text body, exposed to the template as {{message}}.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class ScheduleCampaignDto {
  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;
}

export class ListCampaignsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
}

// ----------------------------------------------------------------- referrals

export const REFERRAL_STATUSES = ['PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED'] as const;
export type ReferralStatusValue = (typeof REFERRAL_STATUSES)[number];

export class ListReferralsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: REFERRAL_STATUSES })
  @IsOptional()
  @IsIn(REFERRAL_STATUSES)
  status?: ReferralStatusValue;
}

export class OverrideReferralDto {
  @ApiProperty({ enum: REFERRAL_STATUSES })
  @IsIn(REFERRAL_STATUSES)
  status!: ReferralStatusValue;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardMinor?: number;
}

export class ApplyReferralDto {
  @ApiProperty()
  @IsString()
  @Length(4, 32)
  code!: string;
}

// ------------------------------------------------------------------- loyalty

export class AdjustLoyaltyDto {
  @ApiProperty({ description: 'Signed points delta.' })
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  points!: number;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  reason!: string;
}

// ----------------------------------------------------------------- analytics

export class NpsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
